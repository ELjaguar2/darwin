// Configuration unique de Darwin, lue depuis les variables d'environnement. Source de vérité : docs/ARCHITECTURE.md §9-10.
// Aucun module ne lit process.env directement : tous reçoivent un `Config` (testable, sans effet de bord).
import { parseNear } from "./money.ts";

export type Preset = "normal" | "demo" | "selection";

/** Paramètres de simulation (montants déjà en yocto, durées en ticks). */
export interface SimParams {
  tickMs: number; // durée réelle d'un tick
  founders: number; // agents de génération 1
  maxPopulation: number; // plafond : au-delà, pas de reproduction
  maxTicks: number; // arrêt automatique (0 = illimité)
  birthCapital: bigint; // capital minimal donné à un enfant (et aux fondateurs)
  metabolism: bigint; // coût de vie débité par tick et par agent
  minVital: bigint; // solde sous ce seuil = mort
  reproCooldownTicks: number;
  simClientRatePerTick: number; // espérance de tâches du client simulé par tick
  taskBudgetMin: bigint;
  taskBudgetMax: bigint;
  bidWindowTicks: number;
  taskDeadlineTicks: number;
  mutationRate: number; // probabilité de mutation par gène
  mutationSd: number; // écart-type relatif des mutations numériques
  nearUsdRate: number; // USD pour 1 NEAR (conversion des coûts IA ; paramètre, pas un cours réel)
  maxTokensPerCall: number;
  settleEveryTicks: number; // regroupement des débits on-chain (métabolisme, coûts IA) tous les N ticks
  visitorHourlyCap: bigint; // plafond de dépense par heure (horloge réelle) du compte `visitors` ; au-delà, POST /api/tasks = 429 (D-025)
}

const N = parseNear;

export const PRESETS: Record<"mock" | "testnet", Record<Preset, SimParams>> = {
  // Mock : montants « confortables », pensés pour que 3 générations tiennent en ~3-5 min en `demo`.
  mock: {
    normal: {
      tickMs: 1000, founders: 4, maxPopulation: 24, maxTicks: 0,
      birthCapital: N("10"), metabolism: N("0.05"), minVital: N("1"), reproCooldownTicks: 20,
      simClientRatePerTick: 1.2, taskBudgetMin: N("0.5"), taskBudgetMax: N("2"),
      bidWindowTicks: 2, taskDeadlineTicks: 8, mutationRate: 0.3, mutationSd: 0.15,
      nearUsdRate: 3, maxTokensPerCall: 400, settleEveryTicks: 1, visitorHourlyCap: N("20"),
    },
    demo: {
      tickMs: 400, founders: 4, maxPopulation: 16, maxTicks: 900,
      birthCapital: N("10"), metabolism: N("0.08"), minVital: N("1.5"), reproCooldownTicks: 10,
      simClientRatePerTick: 1.5, taskBudgetMin: N("0.5"), taskBudgetMax: N("2.5"),
      bidWindowTicks: 1, taskDeadlineTicks: 5, mutationRate: 0.4, mutationSd: 0.2,
      // D-028 : taux bas = coût IA visible (un appel `mock/large` ~0,07 NEAR, `mock/small` ~0,01 NEAR) ; sans effet sur un taux réel.
      nearUsdRate: 0.01, maxTokensPerCall: 300, settleEveryTicks: 1, visitorHourlyCap: N("30"),
    },
    selection: {
      tickMs: 400, founders: 4, maxPopulation: 16, maxTicks: 900,
      birthCapital: N("10"), metabolism: N("0.08"), minVital: N("1.5"), reproCooldownTicks: 10,
      simClientRatePerTick: 1.5, taskBudgetMin: N("0.5"), taskBudgetMax: N("2.5"),
      bidWindowTicks: 1, taskDeadlineTicks: 5, mutationRate: 0.4, mutationSd: 0.2,
      nearUsdRate: 0.01, maxTokensPerCall: 300, settleEveryTicks: 1, visitorHourlyCap: N("30"),
    },
  },
  // Testnet : montants minuscules (le testnet est limité par faucet), ticks lents (latence des transactions).
  testnet: {
    normal: {
      tickMs: 4000, founders: 3, maxPopulation: 10, maxTicks: 0,
      birthCapital: N("0.3"), metabolism: N("0.002"), minVital: N("0.05"), reproCooldownTicks: 15,
      simClientRatePerTick: 0.7, taskBudgetMin: N("0.02"), taskBudgetMax: N("0.08"),
      bidWindowTicks: 1, taskDeadlineTicks: 6, mutationRate: 0.3, mutationSd: 0.15,
      nearUsdRate: 3, maxTokensPerCall: 400, settleEveryTicks: 4, visitorHourlyCap: N("0.5"),
    },
    demo: {
      tickMs: 3000, founders: 3, maxPopulation: 8, maxTicks: 400,
      birthCapital: N("0.2"), metabolism: N("0.004"), minVital: N("0.05"), reproCooldownTicks: 8,
      simClientRatePerTick: 0.9, taskBudgetMin: N("0.02"), taskBudgetMax: N("0.08"),
      bidWindowTicks: 1, taskDeadlineTicks: 4, mutationRate: 0.4, mutationSd: 0.2,
      nearUsdRate: 3, maxTokensPerCall: 300, settleEveryTicks: 4, visitorHourlyCap: N("0.5"),
    },
    // « selection » : la sélection est visible en un seul run réel (morts ET génération 3). Population plafonnée large,
    // capital de naissance modeste, métabolisme fort (un agent sans contrat meurt en une dizaine de ticks), gains
    // supérieurs au métabolisme pour les bons agents (ils se reproduisent), reproduction rapide. Ticks de 10 s :
    // la latence RPC testnet fait qu'un tick réel dure environ une minute.
    selection: {
      tickMs: 10000, founders: 4, maxPopulation: 16, maxTicks: 0,
      birthCapital: N("0.1"), metabolism: N("0.005"), minVital: N("0.03"), reproCooldownTicks: 4,
      simClientRatePerTick: 1.5, taskBudgetMin: N("0.02"), taskBudgetMax: N("0.06"),
      bidWindowTicks: 1, taskDeadlineTicks: 4, mutationRate: 0.4, mutationSd: 0.2,
      nearUsdRate: 3, maxTokensPerCall: 300, settleEveryTicks: 4, visitorHourlyCap: N("0.5"),
    },
  },
};

export interface Config {
  mode: "mock" | "testnet";
  preset: Preset;
  chain: "mock" | "near";
  brain: "mock" | "nearai";
  seed: number;
  sim: SimParams;
  server: { host: string; port: number; dataDir: string; adminToken: string | undefined; allowedHosts: string[] }; // allowedHosts : noms d'hôte supplémentaires acceptés dans l'en-tête Host (anti rebond DNS) ; "*" = tous
  near: {
    network: "testnet";
    rpcUrl: string;
    masterAccountId: string | undefined;
    masterPrivateKey: string | undefined; // SECRET : ne jamais journaliser (utiliser redactConfig)
    contractId: string | undefined;
  };
  nearai: { baseUrl: string; apiKey: string | undefined; model: string | undefined; timeoutMs: number; maxUsdPerRun: number | undefined; maxUsdPerHour: number | undefined }; // apiKey SECRET ; plafonds USD globaux (undefined = défauts du cerveau)
  /**
   * Budget IA réel (L11). Plafond dur `budgetEurStop` (EUR) : une fois atteint, tout appel est refusé (BrainError BUDGET_EXHAUSTED) et la
   * simulation s'arrête proprement. `eurUsdRate` = USD pour 1 EUR (défaut prudent : sous le cours réel => coût en EUR surestimé).
   * `fallback` : fournisseur OpenAI-compatible de secours (AI_BASE_URL / AI_API_KEY / AI_MODEL), apiKey SECRET.
   */
  ai: {
    budgetEurTotal: number;
    budgetEurStop: number;
    eurUsdRate: number;
    fallback: { baseUrl: string; apiKey: string; model: string; usdPerMTokIn: number; usdPerMTokOut: number } | undefined;
  };
  intents: { enabled: boolean; baseUrl: string; jwt: string | undefined; dryOnly: boolean }; // jwt SECRET
}

type Env = Record<string, string | undefined>;

function num(env: Env, key: string, fallback: number): number {
  const v = env[key];
  if (v === undefined || v.trim() === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Variable ${key} invalide : nombre attendu`);
  return n;
}
/** Nombre optionnel strictement positif (plafonds USD) : absent = undefined, invalide ou <= 0 = erreur claire. */
function optNum(env: Env, key: string): number | undefined {
  const v = env[key];
  if (v === undefined || v.trim() === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Variable ${key} invalide : nombre > 0 attendu`);
  return n;
}
const str = (env: Env, key: string): string | undefined => (env[key]?.trim() ? env[key]!.trim() : undefined);
const near = (env: Env, key: string, fallback: bigint): bigint => (str(env, key) ? parseNear(str(env, key)!) : fallback);

/**
 * Règles de résolution :
 *  - DARWIN_MODE=mock (défaut) : chaîne mock + cerveau mock, aucune clé.
 *  - DARWIN_MODE=testnet : chaîne near (exige NEAR_MASTER_*), cerveau nearai si NEARAI_API_KEY, sinon mock + avertissement.
 *  - DARWIN_CHAIN / DARWIN_BRAIN forcent un choix (ex. testnet + cerveau mock).
 */
export function loadConfig(env: Env = process.env): Config {
  const mode = (str(env, "DARWIN_MODE") ?? "mock") as Config["mode"];
  if (mode !== "mock" && mode !== "testnet") throw new Error(`DARWIN_MODE invalide : ${mode} (mock|testnet)`);
  const preset = (str(env, "DARWIN_PRESET") ?? "normal") as Preset;
  if (preset !== "normal" && preset !== "demo" && preset !== "selection") throw new Error(`DARWIN_PRESET invalide : ${preset} (normal|demo|selection)`);

  const apiKey = str(env, "NEARAI_API_KEY");
  const chain = (str(env, "DARWIN_CHAIN") ?? (mode === "testnet" ? "near" : "mock")) as Config["chain"];
  const brain = (str(env, "DARWIN_BRAIN") ?? (mode === "testnet" && (apiKey || (str(env, "AI_API_KEY") && str(env, "AI_BASE_URL") && str(env, "AI_MODEL"))) ? "nearai" : "mock")) as Config["brain"];
  if (chain !== "mock" && chain !== "near") throw new Error(`DARWIN_CHAIN invalide : ${chain}`);
  if (brain !== "mock" && brain !== "nearai") throw new Error(`DARWIN_BRAIN invalide : ${brain}`);

  const fbKey = str(env, "AI_API_KEY");
  const fbUrl = str(env, "AI_BASE_URL");
  const fbModel = str(env, "AI_MODEL");
  const fallback = fbKey && fbUrl && fbModel
    ? {
        baseUrl: fbUrl, apiKey: fbKey, model: fbModel,
        // Prix inconnus d'un fournisseur tiers : valeurs volontairement pessimistes (USD/M tokens) tant que non renseignées.
        usdPerMTokIn: optNum(env, "AI_PRICE_IN_USD_PER_M") ?? 1,
        usdPerMTokOut: optNum(env, "AI_PRICE_OUT_USD_PER_M") ?? 5,
      }
    : undefined;
  const budgetEurTotal = optNum(env, "DARWIN_AI_BUDGET_EUR_TOTAL") ?? 10;
  const budgetEurStop = optNum(env, "DARWIN_AI_BUDGET_EUR_STOP") ?? 8;
  if (budgetEurStop > budgetEurTotal) throw new Error("DARWIN_AI_BUDGET_EUR_STOP doit être <= DARWIN_AI_BUDGET_EUR_TOTAL");

  const base = PRESETS[mode][preset];
  const sim: SimParams = {
    tickMs: num(env, "DARWIN_TICK_MS", base.tickMs),
    founders: num(env, "DARWIN_FOUNDERS", base.founders),
    maxPopulation: num(env, "DARWIN_MAX_POPULATION", base.maxPopulation),
    maxTicks: num(env, "DARWIN_MAX_TICKS", base.maxTicks),
    birthCapital: near(env, "DARWIN_BIRTH_CAPITAL", base.birthCapital),
    metabolism: near(env, "DARWIN_METABOLISM", base.metabolism),
    minVital: near(env, "DARWIN_MIN_VITAL", base.minVital),
    reproCooldownTicks: num(env, "DARWIN_REPRO_COOLDOWN_TICKS", base.reproCooldownTicks),
    simClientRatePerTick: num(env, "DARWIN_SIM_CLIENT_RATE", base.simClientRatePerTick),
    taskBudgetMin: near(env, "DARWIN_TASK_BUDGET_MIN", base.taskBudgetMin),
    taskBudgetMax: near(env, "DARWIN_TASK_BUDGET_MAX", base.taskBudgetMax),
    bidWindowTicks: num(env, "DARWIN_BID_WINDOW_TICKS", base.bidWindowTicks),
    taskDeadlineTicks: num(env, "DARWIN_TASK_DEADLINE_TICKS", base.taskDeadlineTicks),
    mutationRate: num(env, "DARWIN_MUTATION_RATE", base.mutationRate),
    mutationSd: num(env, "DARWIN_MUTATION_SD", base.mutationSd),
    nearUsdRate: num(env, "DARWIN_NEAR_USD_RATE", base.nearUsdRate),
    maxTokensPerCall: num(env, "DARWIN_MAX_TOKENS_PER_CALL", base.maxTokensPerCall),
    settleEveryTicks: num(env, "DARWIN_SETTLE_EVERY_TICKS", base.settleEveryTicks),
    visitorHourlyCap: near(env, "DARWIN_VISITOR_HOURLY_CAP_NEAR", base.visitorHourlyCap),
  };
  if (sim.minVital >= sim.birthCapital) throw new Error("DARWIN_MIN_VITAL doit être < DARWIN_BIRTH_CAPITAL");
  if (sim.taskBudgetMin > sim.taskBudgetMax) throw new Error("DARWIN_TASK_BUDGET_MIN doit être <= DARWIN_TASK_BUDGET_MAX");

  return {
    mode, preset, chain, brain,
    seed: num(env, "DARWIN_SEED", 42),
    sim,
    server: {
      host: str(env, "HOST") ?? "127.0.0.1",
      port: num(env, "PORT", 3000),
      dataDir: str(env, "DARWIN_DATA_DIR") ?? "data",
      adminToken: str(env, "DARWIN_ADMIN_TOKEN"),
      allowedHosts: (str(env, "DARWIN_ALLOWED_HOSTS") ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean),
    },
    near: {
      network: "testnet",
      rpcUrl: str(env, "NEAR_RPC_URL") ?? "https://test.rpc.fastnear.com", // liste officielle docs.near.org/api/rpc/providers (2026-11-09)
      masterAccountId: str(env, "NEAR_MASTER_ACCOUNT_ID"),
      masterPrivateKey: str(env, "NEAR_MASTER_PRIVATE_KEY"),
      contractId: str(env, "NEAR_CONTRACT_ID"),
    },
    nearai: {
      baseUrl: str(env, "NEARAI_BASE_URL") ?? "https://cloud-api.near.ai/v1",
      apiKey,
      model: str(env, "NEARAI_MODEL"),
      timeoutMs: num(env, "NEARAI_TIMEOUT_MS", 60000),
      maxUsdPerRun: optNum(env, "NEARAI_MAX_USD_PER_RUN"),
      maxUsdPerHour: optNum(env, "NEARAI_MAX_USD_PER_HOUR"),
    },
    ai: { budgetEurTotal, budgetEurStop, eurUsdRate: optNum(env, "DARWIN_EUR_USD_RATE") ?? 1.1, fallback },
    intents: {
      enabled: str(env, "INTENTS_ENABLED") === "true",
      baseUrl: str(env, "INTENTS_BASE_URL") ?? "https://1click.chaindefuser.com",
      jwt: str(env, "INTENTS_JWT"),
      dryOnly: str(env, "INTENTS_DRY_ONLY") !== "false",
    },
  };
}

/** Copie journalisable : secrets masqués. À utiliser pour tout log ou endpoint /api/config. */
export function redactConfig(c: Config): unknown {
  const mask = (v: string | undefined) => (v ? "***" : undefined);
  return JSON.parse(
    JSON.stringify(
      {
        ...c,
        near: { ...c.near, masterPrivateKey: mask(c.near.masterPrivateKey) },
        nearai: { ...c.nearai, apiKey: mask(c.nearai.apiKey) },
        ai: { ...c.ai, fallback: c.ai.fallback ? { ...c.ai.fallback, apiKey: mask(c.ai.fallback.apiKey) } : undefined },
        intents: { ...c.intents, jwt: mask(c.intents.jwt) },
        server: { ...c.server, adminToken: mask(c.server.adminToken) },
      },
      (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    ),
  );
}
