// Marché des tâches (L6). Dépend uniquement de `shared/` (Chain, Brain, Journal, Config).
// Règles dures : aucune libération sans verdict `accepted` enregistré ; remboursement seulement sur `rejected` ou `expired` ;
// le validateur n'est jamais l'agent payé ni l'agent qui sous-traite ; texte visiteur toujours en message `user`.
import {
  CATALOGUE, ChainError, TaskInputSchema, formatNear, hashObject, nearPriceOf, parseNear,
  type Bid, type Deliverable, type Deps, type Escrow, type Market, type Profession, type Requester, type Task, type Validation, type Yocto,
} from "../shared/index.ts";
import { rankBids } from "./auction.ts";
import { MarketError } from "./errors.ts";
import { MAX_RESULT_CHARS, brainJudge, professionRule, resultHashOf, type Validator } from "./validation.ts";
import { DeliverableError, extractDeliverable, fileBytes } from "./deliverable.ts";
import { SIMULATED_LABEL_PREFIX } from "./simulated-client.ts";

export * from "./errors.ts";
export * from "./validation.ts";
export * from "./auction.ts";
export * from "./simulated-client.ts";
export * from "./deliverable.ts";
export * from "./checks.ts";
export * from "./events.ts";
export * from "./templates.ts";

/** Étiquettes normalisées (D-024). */
export const VISITOR_FUNDING_LABEL = "Visiteur (financé par le compte de démo)";
export const SIMULATED_BADGE = "simulé";
/** Sous-comptes possédés, créés et financés par le marché (décision du chef de projet après L4). */
export const VISITORS_ACCOUNT_LABEL = "visitors";
export const SIM_CLIENT_ACCOUNT_LABEL = "sim-client";
export const MAX_SUBCONTRACT_DEPTH = 2;
const MAX_BIDS_PER_TASK = 50;
const HOUR_MS = 3_600_000;

export interface MarketOptions {
  /** Numéro de départ des identifiants de tâches (t-XXXX). Testnet : les séquestres du contrat persistent entre deux lancements. Défaut 0. */
  taskSeqStart?: number;
  /** Marge ajoutée à chaque financement des comptes du marché (gaz + réserve de stockage sur chaîne réelle). Défaut 0. */
  fundingMargin?: bigint;
  /** Validateur par type de demandeur. Défaut : juge IA composite (règle de base + brain) pour tous. */
  validators?: Partial<Record<Requester["kind"], Validator>>;
  /** Plafond de dépense par heure du compte visiteurs. Défaut : `config.sim.visitorHourlyCap` si présent, sinon 10 x budget max. */
  visitorHourlyCap?: bigint;
  /** Ticks de grâce après le délai pour retenter une validation différée avant remboursement. Défaut : taskDeadlineTicks. */
  validationGraceTicks?: number;
  /** Variation de réputation : accepté / rejeté / expiré. */
  reputationDeltas?: { accepted: number; rejected: number; expired: number };
}

export interface TaskMarket extends Market {
  /** Formulaire visiteur : valide `TaskInput`, applique budget min/max et plafond horaire (MarketError 400/429). */
  postVisitorTask(input: unknown): Promise<Task>;
  getEscrow(taskId: string): Escrow | undefined;
  accountIds(): { visitors: string; simClient: string };
  /** Dépense visiteurs comptée sur l'heure glissante. */
  visitorSpentLastHour(): bigint;
  visitorHourlyCap(): bigint;
}

type Settleable = "rejected" | "expired";

const clone = <T>(v: T): T => structuredClone(v);
const cleanLabel = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 60) || "visiteur";

export function createMarket(deps: Deps, opts: MarketOptions = {}): TaskMarket {
  const { chain, journal, config } = deps;
  const sim = config.sim;
  const graceTicks = opts.validationGraceTicks ?? sim.taskDeadlineTicks;
  const deltas = opts.reputationDeltas ?? { accepted: 1, rejected: -2, expired: -2 };
  const masterId = chain.info().masterId;
  const accounts = { visitors: `${VISITORS_ACCOUNT_LABEL}.${masterId}`, simClient: `${SIM_CLIENT_ACCOUNT_LABEL}.${masterId}` };
  const cap = opts.visitorHourlyCap ?? (config.sim as { visitorHourlyCap?: bigint }).visitorHourlyCap ?? sim.taskBudgetMax * 10n;
  const defaultValidator = brainJudge({ brain: deps.brain, journal, config, rule: professionRule() });
  const validatorFor = (k: Requester["kind"]): Validator => opts.validators?.[k] ?? defaultValidator;

  const deliverables = new Map<string, Deliverable>();
  /** Coût IA de production (USD) cumulé par tâche : `brain.charged` `execute_task` de l'agent, rattaché à sa plus ancienne tâche attribuée non remise. */
  const productionCost = new Map<string, number>();
  const tasks = new Map<string, Task>();
  const bids = new Map<string, Bid>();
  const escrows = new Map<string, Escrow>();
  const reputationDone = new Set<string>();
  const busy = new Set<string>();
  const ledger: { at: number; amount: bigint }[] = [];
  const fundingMargin = opts.fundingMargin ?? 0n;
  let taskSeq = Math.max(0, Math.floor(opts.taskSeqStart ?? 0));
  let bidSeq = 0;
  let stepTick = 0;
  let stepQueue: Promise<void> = Promise.resolve();

  /** Tick courant : dernier `step`, ou tick du dernier événement du journal s'il est plus récent. */
  let journalTick = 0;
  journal.subscribe((e) => {
    journalTick = Math.max(journalTick, e.tick);
    if (e.type === "brain.charged" && e.data.purpose === "execute_task") {
      const t = [...tasks.values()].find((x) => x.status === "awarded" && x.winnerId === e.data.agentId);
      if (t) productionCost.set(t.id, (productionCost.get(t.id) ?? 0) + e.data.costUsd);
    }
  });
  const currentTick = (): number => Math.max(stepTick, journalTick);
  const emit = journal.emit.bind(journal);
  const pad = (n: number) => String(n).padStart(4, "0");

  function pruneLedger(): void {
    const cutoff = deps.now().getTime() - HOUR_MS;
    while (ledger.length && ledger[0]!.at <= cutoff) ledger.shift();
  }
  const spent = () => (pruneLedger(), ledger.reduce((a, l) => a + l.amount, 0n));

  function mustTask(id: string): Task {
    const t = tasks.get(id);
    if (!t) throw new MarketError("UNKNOWN_TASK", `Tâche inconnue : ${id}`);
    return t;
  }

  async function agentRecord(agentId: string) {
    const r = await chain.getAgentRecord(agentId);
    if (!r) throw new MarketError("UNKNOWN_AGENT", `Agent inconnu du registre : ${agentId}`);
    return r;
  }

  function winningPrice(t: Task): bigint {
    return BigInt(bids.get(t.winningBidId ?? "")?.price ?? "0");
  }

  /** Le marché possède et finance ses comptes : création au premier besoin, complément depuis le maître ensuite. */
  async function ensureFunded(label: string, accountId: string, price: bigint, source: "master" | "demo"): Promise<void> {
    // Marge : le séquestre exige le prix + gaz + réserve de stockage, et plusieurs tâches peuvent se verrouiller dans le même tick.
    const amount = price + fundingMargin;
    let balance: bigint;
    try {
      balance = BigInt(await chain.getBalance(accountId));
    } catch (e) {
      if (!(e instanceof ChainError) || e.code !== "UNKNOWN_ACCOUNT") throw e;
      const r = await chain.createAccount({ label, initialFunding: amount.toString() });
      emit({ type: "funding.received", tick: currentTick(), data: { to: r.accountId, amount: amount.toString(), source, tx: r.tx.hash } });
      return;
    }
    if (balance >= amount) return;
    const missing = amount - balance;
    const tx = await chain.transfer({ from: masterId, to: accountId, amount: missing.toString(), memo: `top-up ${label}` });
    emit({ type: "funding.received", tick: currentTick(), data: { to: accountId, amount: missing.toString(), source, tx: tx.hash } });
  }

  async function payerAccount(t: Task, price: bigint): Promise<string> {
    switch (t.requester.kind) {
      case "visitor":
        await ensureFunded(VISITORS_ACCOUNT_LABEL, accounts.visitors, price, "demo");
        return accounts.visitors;
      case "simulated":
        await ensureFunded(SIM_CLIENT_ACCOUNT_LABEL, accounts.simClient, price, "master");
        return accounts.simClient;
      case "agent":
        return (await agentRecord(t.requester.agentId)).accountId;
    }
  }

  // ---------- publication ----------
  async function postTask(input: Parameters<Market["postTask"]>[0]): Promise<Task> {
    const budget = BigInt(input.budget);
    if (budget <= 0n) throw new MarketError("INVALID_INPUT", "budget doit être > 0");
    if (!input.title.trim() || !input.prompt.trim()) throw new MarketError("INVALID_INPUT", "titre et prompt requis");
    const tick = currentTick();
    let requester: Requester = clone(input.requester);

    if (requester.kind === "agent") {
      const parent = input.parentTaskId ? tasks.get(input.parentTaskId) : undefined;
      if (!parent) throw new MarketError("INVALID_SUBCONTRACT", "une sous-traitance exige une tâche parente connue");
      if (parent.status !== "awarded" || parent.winnerId !== requester.agentId)
        throw new MarketError("INVALID_SUBCONTRACT", "seul le gagnant d'une tâche attribuée peut sous-traiter");
      if (budget >= winningPrice(parent)) throw new MarketError("INVALID_SUBCONTRACT", "le budget sous-traité doit rester < au prix gagnant (l'agent garde la marge)");
      let depth = 1;
      for (let p: Task | undefined = parent; p?.parentTaskId; p = tasks.get(p.parentTaskId)) depth++;
      if (depth > MAX_SUBCONTRACT_DEPTH) throw new MarketError("INVALID_SUBCONTRACT", "profondeur de sous-traitance maximale atteinte");
      await agentRecord(requester.agentId);
    } else {
      if (input.parentTaskId) throw new MarketError("INVALID_SUBCONTRACT", "parentTaskId réservé aux agents");
      // Prix plancher du métier (catalogue L16) ; plafond = la borne de config, relevée si besoin au plancher du métier.
      if (!CATALOGUE[input.profession]) throw new MarketError("INVALID_INPUT", `métier inconnu : ${String(input.profession)}`);
      const floor = BigInt(nearPriceOf(input.profession, deps.config.sim.priceScale));
      if (budget < floor)
        throw new MarketError("BUDGET_OUT_OF_RANGE", `budget minimum pour ${CATALOGUE[input.profession].label} : ${formatNear(floor, 6)} NEAR (reçu ${formatNear(budget, 6)} NEAR)`);
      if (budget > (sim.taskBudgetMax > floor ? sim.taskBudgetMax : floor)) throw new MarketError("BUDGET_OUT_OF_RANGE", `budget maximum : ${formatNear(sim.taskBudgetMax, 6)} NEAR`);
      if (requester.kind === "simulated") {
        const label = cleanLabel(requester.label);
        requester = { kind: "simulated", label: label.startsWith(SIMULATED_LABEL_PREFIX) ? label : `${SIMULATED_LABEL_PREFIX} : ${label}`.slice(0, 80) };
      } else {
        requester = { kind: "visitor", label: cleanLabel(requester.label) }; // le compte payeur est toujours `visitors`, jamais fourni par l'appelant
        if (spent() + budget > cap)
          throw new MarketError("VISITOR_CAP_EXCEEDED", `plafond horaire des tâches visiteurs atteint (${cap} yocto/h) : réessayez plus tard`);
        ledger.push({ at: deps.now().getTime(), amount: budget });
      }
    }

    const biddingEndsTick = tick + sim.bidWindowTicks;
    const task: Task = {
      id: `t-${pad(++taskSeq)}`, requester, profession: input.profession, title: input.title.trim().slice(0, 120), prompt: input.prompt,
      budget: budget.toString(), status: "posted", createdTick: tick, biddingEndsTick,
      deadlineTick: biddingEndsTick + sim.taskDeadlineTicks, bidIds: [],
      ...(input.parentTaskId ? { parentTaskId: input.parentTaskId } : {}),
    };
    tasks.set(task.id, task);
    emit({ type: "task.posted", tick, data: { task: clone(task) } });
    if (requester.kind === "agent" && task.parentTaskId)
      emit({ type: "subcontract.created", tick, data: { parentTaskId: task.parentTaskId, childTaskId: task.id, byAgentId: requester.agentId } });
    return clone(task);
  }

  async function postVisitorTask(input: unknown): Promise<Task> {
    const p = TaskInputSchema.safeParse(input);
    if (!p.success) throw new MarketError("INVALID_INPUT", p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    return postTask({
      requester: { kind: "visitor", label: p.data.requesterLabel }, profession: p.data.profession as Profession,
      title: p.data.title, prompt: p.data.prompt, budget: parseNear(p.data.budgetNear).toString(),
    });
  }

  // ---------- enchères ----------
  async function placeBid(input: Parameters<Market["placeBid"]>[0]): Promise<Bid> {
    const task = mustTask(input.taskId);
    if (task.status !== "posted") throw new MarketError("NOT_OPEN", "enchères closes");
    const price = BigInt(input.price);
    if (price <= 0n || price > BigInt(task.budget)) throw new MarketError("INVALID_INPUT", "prix hors de ]0, budget]");
    if (!Number.isInteger(input.etaTicks) || input.etaTicks < 1) throw new MarketError("INVALID_INPUT", "etaTicks entier >= 1");
    const rec = await agentRecord(input.agentId);
    if (!rec.alive) throw new MarketError("UNKNOWN_AGENT", `agent mort : ${input.agentId}`);
    if (task.bidIds.length >= MAX_BIDS_PER_TASK) throw new MarketError("NOT_OPEN", "trop d'offres");
    if (task.bidIds.some((id) => bids.get(id)?.agentId === input.agentId)) throw new MarketError("DUPLICATE_BID", "une seule offre par agent");
    // pas d'auto-contrat : ni le demandeur, ni aucun demandeur ancêtre dans la chaîne de sous-traitance
    for (let t: Task | undefined = task; t; t = t.parentTaskId ? tasks.get(t.parentTaskId) : undefined) {
      if (t.requester.kind === "agent" && t.requester.agentId === input.agentId) throw new MarketError("SELF_DEALING", "un agent ne peut pas enchérir sur sa propre chaîne de sous-traitance");
    }
    const bid: Bid = {
      id: `b-${pad(++bidSeq)}`, taskId: task.id, agentId: input.agentId, price: price.toString(), etaTicks: input.etaTicks,
      tick: currentTick(), ...(input.pitch ? { pitch: input.pitch.slice(0, 300) } : {}),
    };
    bids.set(bid.id, bid);
    task.bidIds.push(bid.id);
    emit({ type: "bid.placed", tick: bid.tick, data: { bid: clone(bid) } });
    return clone(bid);
  }

  // ---------- attribution ----------
  async function award(task: Task, tick: number): Promise<void> {
    const ranked: { bid: Bid; reputation: number }[] = [];
    for (const id of task.bidIds) {
      const bid = bids.get(id)!;
      const rec = await chain.getAgentRecord(bid.agentId);
      if (rec?.alive) ranked.push({ bid, reputation: await chain.getReputation(bid.agentId) });
    }
    const best = rankBids(ranked)[0];
    if (!best) return void (await expire(task, "no_bids", tick));
    const price = BigInt(best.bid.price);
    try {
      const payer = await payerAccount(task, price);
      const tx = await chain.lockEscrow({ taskId: task.id, payer, amount: price.toString() });
      const winner = await agentRecord(best.bid.agentId);
      escrows.set(task.id, { id: task.id, taskId: task.id, payer, payee: winner.accountId, amount: price.toString(), status: "locked", lockTx: tx.hash });
      best.bid.won = true;
      Object.assign(task, { status: "awarded", winnerId: best.bid.agentId, winningBidId: best.bid.id, escrowId: task.id });
      emit({ type: "task.awarded", tick, data: { taskId: task.id, bidId: best.bid.id, winnerId: best.bid.agentId, price: best.bid.price, bids: ranked.length } });
      emit({ type: "escrow.locked", tick, data: { taskId: task.id, payer, amount: price.toString(), tx: tx.hash } });
    } catch (e) {
      // Fonds du demandeur indisponibles : rien n'est verrouillé, rien à rembourser. Le catalogue n'a pas de motif dédié (voir README).
      emit({ type: "system.warning", tick, data: { code: "ESCROW_LOCK_FAILED", message: `${task.id} : ${(e as Error).message}`.slice(0, 300) } });
      await expire(task, "no_bids", tick);
    }
  }

  // ---------- réputation ----------
  async function reputation(task: Task, agentId: string, delta: number, proofHash: string, tick: number): Promise<void> {
    const key = `${task.id}:${agentId}`;
    if (reputationDone.has(key)) return;
    try {
      const r = await chain.addReputation({ agentId, taskId: task.id, delta, proofHash });
      reputationDone.add(key);
      emit({ type: "reputation.updated", tick, data: { agentId, delta, total: r.total, taskId: task.id, tx: r.tx.hash } });
    } catch (e) {
      emit({ type: "system.warning", tick, data: { code: "REPUTATION_FAILED", message: `${task.id} : ${(e as Error).message}`.slice(0, 300) } });
    }
  }

  // ---------- remboursement (uniquement rejected / expired) ----------
  async function refund(task: Task, cause: Settleable, tick: number): Promise<void> {
    const esc = escrows.get(task.id);
    if (!esc || esc.status !== "locked") return;
    if (cause === "rejected" && task.validation?.verdict !== "rejected") throw new MarketError("ESCROW_MISMATCH", "remboursement 'rejected' sans verdict rejeté");
    if (cause === "expired" && task.status !== "expired") throw new MarketError("ESCROW_MISMATCH", "remboursement 'expired' sur une tâche non expirée");
    const tx = await chain.refundEscrow({ taskId: task.id, reason: cause });
    esc.status = "refunded";
    esc.settleTx = tx.hash;
    emit({ type: "escrow.refunded", tick, data: { taskId: task.id, payer: esc.payer, amount: esc.amount, tx: tx.hash } });
  }

  async function expire(task: Task, reason: "no_bids" | "deadline", tick: number, penalize = true): Promise<void> {
    const winner = task.winnerId;
    task.status = "expired";
    emit({ type: "task.expired", tick, data: { taskId: task.id, reason } });
    await refund(task, "expired", tick);
    if (winner && reason === "deadline" && penalize) await reputation(task, winner, deltas.expired, hashObject({ taskId: task.id, event: "expired" }), tick);
  }

  // ---------- paiement ----------
  async function settle(task: Task, tick: number): Promise<void> {
    const v = task.validation;
    const esc = escrows.get(task.id);
    if (!v || !esc || !task.result || !task.winnerId) return;
    if (v.verdict === "rejected") {
      await refund(task, "rejected", tick);
      task.status = "rejected";
      await reputation(task, task.winnerId, deltas.rejected, v.resultHash, tick);
      return;
    }
    if (v.resultHash !== task.result.resultHash) throw new MarketError("ESCROW_MISMATCH", "résultat modifié depuis la validation");
    const onChain = await chain.getEscrow(task.id);
    if (!onChain || onChain.status !== "locked" || onChain.amount !== esc.amount || onChain.payer !== esc.payer)
      throw new MarketError("ESCROW_MISMATCH", "séquestre on-chain différent de celui du marché");
    const proof = { resultHash: v.resultHash, verdict: "accepted" as const, validator: v.validator };
    try {
      const tx = await chain.releaseEscrow({ taskId: task.id, payee: esc.payee!, proof });
      esc.status = "released";
      esc.settleTx = tx.hash;
      esc.proof = proof;
      task.status = "settled";
      emit({ type: "escrow.released", tick, data: { taskId: task.id, payee: esc.payee!, amount: esc.amount, tx: tx.hash } });
    } catch (e) {
      if (e instanceof ChainError && (e.code === "ACCOUNT_DELETED" || e.code === "UNKNOWN_ACCOUNT")) {
        // bénéficiaire mort avant le paiement : le séquestre revient au demandeur (traité comme expiré)
        await expire(task, "deadline", tick);
        return;
      }
      throw e;
    }
    await reputation(task, task.winnerId, deltas.accepted, v.resultHash, tick);
  }

  async function trySettle(task: Task, tick: number): Promise<void> {
    try {
      await settle(task, tick);
    } catch (e) {
      emit({ type: "system.warning", tick, data: { code: "SETTLEMENT_PENDING", message: `${task.id} : ${(e as Error).message}`.slice(0, 300) } });
    }
  }

  // ---------- avance du marché ----------
  async function stepInner(tick: number): Promise<void> {
    stepTick = Math.max(stepTick, tick);
    for (const t of [...tasks.values()]) {
      if (busy.has(t.id)) continue;
      busy.add(t.id);
      try {
        if (t.status === "submitted" && t.validation) await trySettle(t, tick); // reprise d'un paiement interrompu
        else if (t.status === "submitted") {
          // validation différée (juge indisponible ou plafond d'appels) : nouvel essai à chaque step ;
          // au-delà du délai de grâce, remboursement sans pénalité pour l'agent (la panne n'est pas de son fait)
          if (tick > t.deadlineTick + graceTicks) await expire(t, "deadline", tick, false);
          else {
            try {
              await validateAndSettle(t, tick);
            } catch (e) {
              emit({ type: "system.warning", tick, data: { code: "VALIDATION_PENDING", message: `${t.id} : ${(e as Error).message}`.slice(0, 300) } });
            }
          }
        }
        else if (t.status === "posted" && t.biddingEndsTick <= tick) await award(t, tick);
        else if (t.status === "awarded") {
          const rec = t.winnerId ? await chain.getAgentRecord(t.winnerId) : null;
          if (tick > t.deadlineTick || !rec?.alive) await expire(t, "deadline", tick);
        }
      } finally {
        busy.delete(t.id);
      }
    }
  }
  const step = (tick: number): Promise<void> => {
    const run = stepQueue.then(() => stepInner(tick));
    stepQueue = run.catch(() => undefined);
    return run;
  };

  // ---------- exécution : remise du résultat ----------
  async function submitResult(input: Parameters<Market["submitResult"]>[0]): Promise<{ task: Task; validation: Validation }> {
    const task = mustTask(input.taskId);
    if (task.status !== "awarded" || busy.has(task.id)) throw new MarketError("NOT_AWARDED", "tâche non en attente de résultat");
    if (task.winnerId !== input.agentId) throw new MarketError("NOT_WINNER", "seul le gagnant peut remettre le résultat");
    const tick = currentTick();
    if (tick > task.deadlineTick) throw new MarketError("DEADLINE_PASSED", "délai d'exécution dépassé");
    const text = input.text.trim();
    if (!text || text.length > MAX_RESULT_CHARS) throw new MarketError("INVALID_INPUT", "résultat vide ou trop long");

    busy.add(task.id);
    task.status = "submitted";
    const resultHash = resultHashOf(text);
    task.result = { text, resultHash, submittedTick: tick };
    emit({ type: "task.submitted", tick, data: { taskId: task.id, agentId: input.agentId, resultHash } });
    try {
      const validation = await validateAndSettle(task, tick);
      return { task: clone(task), validation: clone(validation) };
    } catch (e) {
      // Échec fermé : validation impossible (juge indisponible, plafond d'appels, panne, validateur interdit).
      // Rien n'est payé ni remboursé ; la tâche reste `submitted`, `step` retente puis rembourse après le délai de grâce.
      const msg = (e as Error).message;
      emit({ type: "system.warning", tick, data: { code: "VALIDATION_PENDING", message: `${task.id} : ${msg}`.slice(0, 300) } });
      throw new MarketError(e instanceof MarketError && e.code === "INVALID_VALIDATOR" ? "INVALID_VALIDATOR" : "VALIDATION_PENDING", msg);
    } finally {
      busy.delete(task.id);
    }
  }

  /** Extrait et conserve le livrable (si le format est valide), puis journalise `deliverable.produced`. Aucun effet sur le paiement. */
  function recordDeliverable(task: Task, validation: Validation, judgeCostUsd: number, tick: number): void {
    if (deliverables.has(task.id)) return;
    try {
      const d = extractDeliverable(task, task.winnerId!, task.result!.text, {
        productionCostUsd: Math.round((productionCost.get(task.id) ?? 0) * 1e8) / 1e8, judgeCostUsd: Math.round(judgeCostUsd * 1e8) / 1e8, createdAt: deps.now().toISOString(),
      });
      d.verdict = validation.verdict;
      d.score = validation.score;
      deliverables.set(task.id, d);
      emit({
        type: "deliverable.produced", tick,
        data: { taskId: d.taskId, profession: d.profession, agentId: d.agentId, files: fileBytes(d), productionCostUsd: d.productionCostUsd, judgeCostUsd: d.judgeCostUsd, resultHash: d.resultHash },
      });
    } catch (e) {
      // format invalide : rien à stocker (le juge de métier rejette ce cas) ; toute autre erreur ne doit jamais bloquer le règlement
      if (!(e instanceof DeliverableError)) emit({ type: "system.warning", tick, data: { code: "DELIVERABLE_FAILED", message: `${task.id} : ${(e as Error).message}`.slice(0, 300) } });
    }
  }

  /** Valide le résultat remis puis règle (paiement ou remboursement). Lève si aucune validation n'a pu être enregistrée. */
  async function validateAndSettle(task: Task, tick: number): Promise<Validation> {
    const result = task.result!;
    const validator = validatorFor(task.requester.kind);
    const verdict = await validator.validate({ task: clone(task), agentId: task.winnerId!, text: result.text, resultHash: result.resultHash, tick });
    const who = verdict.validator;
    const requesterAgent = task.requester.kind === "agent" ? task.requester.agentId : undefined;
    if (!who || who.startsWith("agent:") || who === task.winnerId || who === requesterAgent)
      throw new MarketError("INVALID_VALIDATOR", `validateur interdit : ${who}`);
    if (verdict.verdict !== "accepted" && verdict.verdict !== "rejected") throw new MarketError("INVALID_VALIDATOR", "verdict invalide");
    const validation: Validation = {
      verdict: verdict.verdict, score: Math.min(1, Math.max(0, Number.isFinite(verdict.score) ? verdict.score : 0)),
      validator: who, reason: verdict.reason.slice(0, 300), resultHash: result.resultHash, tick,
    };
    task.validation = validation;
    emit({ type: "task.validated", tick, data: { taskId: task.id, validation: clone(validation) } });
    recordDeliverable(task, validation, verdict.costUsd ?? 0, tick);
    await trySettle(task, tick);
    return validation;
  }

  return {
    postTask, placeBid, step, submitResult, postVisitorTask,
    getTask: (id) => (tasks.has(id) ? clone(tasks.get(id)!) : undefined),
    listTasks: (f) => [...tasks.values()].filter((t) => (!f?.status || t.status === f.status) && (!f?.profession || t.profession === f.profession)).map(clone),
    openTasks: (p) => [...tasks.values()].filter((t) => t.status === "posted" && (!p || t.profession === p)).map(clone),
    getDeliverable: (id) => (deliverables.has(id) ? clone(deliverables.get(id)!) : undefined),
    listDeliverables: () => [...deliverables.values()].map(clone),
    getEscrow: (id) => (escrows.has(id) ? clone(escrows.get(id)!) : undefined),
    accountIds: () => ({ ...accounts }),
    visitorSpentLastHour: spent,
    visitorHourlyCap: () => cap,
  };
}

export type { Yocto };
