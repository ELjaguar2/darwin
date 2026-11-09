// Stub de Market pour les tests du moteur (L6 en fournit l'implémentation réelle). Minimal mais fidèle au contrat :
// enchères au meilleur prix, séquestre verrouillé à l'attribution (montant = prix gagnant), validation par règle
// déterministe (jamais l'agent payé), libération uniquement avec preuve `accepted`, réputation, échéances.
// Ne pas utiliser en production.
import {
  parseNear, sha256Hex, toYocto, type Bid, type Chain, type Deps, type Market, type Profession, type Requester, type Task, type Validation,
} from "../shared/index.ts";

export class StubMarket implements Market {
  private tasks = new Map<string, Task>();
  private bids = new Map<string, Bid>();
  private nTask = 0;
  private nBid = 0;
  private tick = 0;
  private simAccount?: string;
  private chain: Chain;

  constructor(private deps: Deps) {
    this.chain = deps.chain;
    deps.journal.subscribe((e) => {
      if (e.tick > this.tick) this.tick = e.tick;
    });
  }

  private async payerOf(r: Requester): Promise<string> {
    if (r.kind === "agent") {
      const rec = await this.chain.getAgentRecord(r.agentId);
      if (!rec) throw new Error(`agent inconnu ${r.agentId}`);
      return rec.accountId;
    }
    if (!this.simAccount) {
      this.simAccount = (await this.chain.createAccount({ label: "sim-client", initialFunding: toYocto(parseNear("100000")) })).accountId;
    }
    return this.simAccount;
  }

  async postTask(input: { requester: Requester; profession: Profession; title: string; prompt: string; budget: string; parentTaskId?: string }): Promise<Task> {
    const { sim } = this.deps.config;
    await this.payerOf(input.requester);
    const id = `t-${String(++this.nTask).padStart(4, "0")}`;
    const task: Task = {
      id, requester: input.requester, parentTaskId: input.parentTaskId, profession: input.profession, title: input.title,
      prompt: input.prompt, budget: input.budget, status: "posted", createdTick: this.tick,
      biddingEndsTick: this.tick + sim.bidWindowTicks, deadlineTick: this.tick + sim.bidWindowTicks + sim.taskDeadlineTicks, bidIds: [],
    };
    this.tasks.set(id, task);
    this.deps.journal.emit({ type: "task.posted", data: { task: structuredClone(task) } });
    if (input.parentTaskId) {
      this.deps.journal.emit({ type: "subcontract.created", data: { parentTaskId: input.parentTaskId, childTaskId: id, byAgentId: (input.requester as { agentId: string }).agentId } });
    }
    return task;
  }

  async placeBid(input: { taskId: string; agentId: string; price: string; etaTicks: number; pitch?: string }): Promise<Bid> {
    const t = this.tasks.get(input.taskId);
    if (!t || t.status !== "posted") throw new Error(`tâche non ouverte ${input.taskId}`);
    const bid: Bid = { id: `b-${String(++this.nBid).padStart(5, "0")}`, ...input, tick: this.tick };
    this.bids.set(bid.id, bid);
    t.bidIds.push(bid.id);
    this.deps.journal.emit({ type: "bid.placed", data: { bid: structuredClone(bid) } });
    return bid;
  }

  private async expire(t: Task, reason: "no_bids" | "deadline") {
    if (t.escrowId) {
      // La chaîne n'accepte que `rejected` ou `expired` (règles du contrat) : `no_bids` et `deadline` sont des expirations.
      const tx = await this.chain.refundEscrow({ taskId: t.id, reason: "expired" });
      const e = await this.chain.getEscrow(t.id);
      this.deps.journal.emit({ type: "escrow.refunded", data: { taskId: t.id, payer: e!.payer, amount: e!.amount, tx: tx.hash } });
    }
    t.status = "expired";
    this.deps.journal.emit({ type: "task.expired", data: { taskId: t.id, reason } });
  }

  async step(tick: number): Promise<void> {
    this.tick = tick;
    for (const t of [...this.tasks.values()]) {
      if (t.status === "posted" && t.biddingEndsTick <= tick) {
        const bids = t.bidIds.map((id) => this.bids.get(id)!);
        if (bids.length === 0) {
          await this.expire(t, "no_bids");
          continue;
        }
        const scored = await Promise.all(bids.map(async (b) => ({ b, rep: await this.chain.getReputation(b.agentId) })));
        scored.sort((x, y) => (BigInt(x.b.price) < BigInt(y.b.price) ? -1 : BigInt(x.b.price) > BigInt(y.b.price) ? 1 : y.rep - x.rep || (x.b.id < y.b.id ? -1 : 1)));
        const win = scored[0]!.b;
        try {
          const tx = await this.chain.lockEscrow({ taskId: t.id, payer: await this.payerOf(t.requester), amount: win.price });
          t.escrowId = t.id;
          win.won = true;
          t.winnerId = win.agentId;
          t.winningBidId = win.id;
          t.status = "awarded";
          this.deps.journal.emit({ type: "task.awarded", data: { taskId: t.id, bidId: win.id, winnerId: win.agentId, price: win.price, bids: bids.length } });
          this.deps.journal.emit({ type: "escrow.locked", data: { taskId: t.id, payer: await this.payerOf(t.requester), amount: win.price, tx: tx.hash } });
        } catch {
          await this.expire(t, "deadline");
        }
      } else if (t.status === "awarded" && t.deadlineTick < tick) {
        await this.expire(t, "deadline");
      }
    }
  }

  async submitResult(input: { taskId: string; agentId: string; text: string }): Promise<{ task: Task; validation: Validation }> {
    const t = this.tasks.get(input.taskId);
    if (!t || t.status !== "awarded" || t.winnerId !== input.agentId) throw new Error(`soumission refusée ${input.taskId}`);
    const resultHash = sha256Hex(input.text + t.id);
    t.result = { text: input.text, resultHash, submittedTick: this.tick };
    t.status = "submitted";
    this.deps.journal.emit({ type: "task.submitted", data: { taskId: t.id, agentId: input.agentId, resultHash } });
    const accepted = parseInt(sha256Hex(`${t.id}|${input.agentId}|${input.text}`).slice(0, 2), 16) % 10 !== 0; // ~90 %
    const validation: Validation = {
      verdict: accepted ? "accepted" : "rejected", score: accepted ? 0.8 : 0.2, validator: "rule:stub",
      reason: accepted ? "règle déterministe : accepté" : "règle déterministe : refusé", resultHash, tick: this.tick,
    };
    t.validation = validation;
    this.deps.journal.emit({ type: "task.validated", data: { taskId: t.id, validation } });
    const esc = (await this.chain.getEscrow(t.id))!;
    if (accepted) {
      const rec = (await this.chain.getAgentRecord(input.agentId))!;
      const tx = await this.chain.releaseEscrow({ taskId: t.id, payee: rec.accountId, proof: { resultHash, verdict: "accepted", validator: "rule:stub" } });
      t.status = "settled";
      this.deps.journal.emit({ type: "escrow.released", data: { taskId: t.id, payee: rec.accountId, amount: esc.amount, tx: tx.hash } });
      const rep = await this.chain.addReputation({ agentId: input.agentId, taskId: t.id, delta: 1, proofHash: resultHash });
      this.deps.journal.emit({ type: "reputation.updated", data: { agentId: input.agentId, delta: 1, total: rep.total, taskId: t.id, tx: rep.tx.hash } });
    } else {
      const tx = await this.chain.refundEscrow({ taskId: t.id, reason: "rejected" });
      t.status = "rejected";
      this.deps.journal.emit({ type: "escrow.refunded", data: { taskId: t.id, payer: esc.payer, amount: esc.amount, tx: tx.hash } });
    }
    return { task: t, validation };
  }

  getTask = (id: string) => this.tasks.get(id);
  listTasks = (f?: { status?: Task["status"]; profession?: Profession }) =>
    [...this.tasks.values()].filter((t) => (!f?.status || t.status === f.status) && (!f?.profession || t.profession === f.profession));
  openTasks = (p?: Profession) => this.listTasks({ status: "posted", profession: p });
}
