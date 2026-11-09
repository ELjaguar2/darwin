// Contrôles de démarrage (avant toute construction) : version de Node et variables du mode testnet.
// Les messages citent les variables par NOM, jamais leur valeur.
import type { Config } from "../shared/index.ts";

export const MIN_NODE = "22.12.0";
export const MIN_NODE_TESTNET = "22.22.2"; // near-api-js 7.4.0 (champ engines)

function parse(v: string): [number, number, number] {
  const [a = 0, b = 0, c = 0] = v.replace(/^v/, "").split(".").map((x) => parseInt(x, 10) || 0);
  return [a, b, c];
}
export function versionLt(a: string, b: string): boolean {
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) if (x[i]! !== y[i]!) return x[i]! < y[i]!;
  return false;
}

/** `error` : refus de démarrer ; `warning` : on démarre en le disant. */
export function checkNodeVersion(version: string, mode: Config["mode"]): { error?: string; warning?: string } {
  if (versionLt(version, MIN_NODE)) {
    return { error: `Node ${version} trop ancien : Node >= ${MIN_NODE} est requis (champ engines de package.json). Installez Node 22 LTS.` };
  }
  if (mode === "testnet" && versionLt(version, MIN_NODE_TESTNET)) {
    return { warning: `Node ${version} : le mode testnet exige Node >= ${MIN_NODE_TESTNET} (near-api-js 7.4.0 ; sinon le paquet est ignoré à l'installation et le démarrage échouera). Le mode mock n'est pas concerné.` };
  }
  return {};
}

/** Variables NEAR manquantes en mode testnet avec chaîne near : message orienté vers .env.example et le README. */
export function checkTestnetEnv(config: Config): string | undefined {
  if (config.chain !== "near") return undefined;
  const missing: string[] = [];
  if (!config.near.masterAccountId) missing.push("NEAR_MASTER_ACCOUNT_ID");
  if (!config.near.masterPrivateKey) missing.push("NEAR_MASTER_PRIVATE_KEY");
  if (!missing.length) return undefined;
  return `Mode testnet : variable(s) manquante(s) : ${missing.join(", ")}. Copiez .env.example vers .env et renseignez-les (voir le README, section « Run it in testnet mode »). Pour essayer sans clé : npm run start:mock.`;
}
