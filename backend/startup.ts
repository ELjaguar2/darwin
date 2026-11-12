// Startup checks (before any construction): Node version and testnet-mode variables.
// Messages cite variables by NAME, never their value.
import type { Config } from "../shared/index.ts";

export const MIN_NODE = "22.12.0";
export const MIN_NODE_TESTNET = "22.22.2"; // near-api-js 7.4.0 (engines field)

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

/** `error`: refuses to start; `warning`: starts and says so. */
export function checkNodeVersion(version: string, mode: Config["mode"]): { error?: string; warning?: string } {
  if (versionLt(version, MIN_NODE)) {
    return { error: `Node ${version} is too old: Node >= ${MIN_NODE} is required (engines field of package.json). Install Node 22 LTS.` };
  }
  if (mode === "testnet" && versionLt(version, MIN_NODE_TESTNET)) {
    return { warning: `Node ${version}: testnet mode requires Node >= ${MIN_NODE_TESTNET} (near-api-js 7.4.0; otherwise the package is skipped at install time and startup will fail). Mock mode is not affected.` };
  }
  return {};
}

/** NEAR variables missing in testnet mode with the near chain: message pointing to .env.example and the README. */
export function checkTestnetEnv(config: Config): string | undefined {
  if (config.chain !== "near") return undefined;
  const missing: string[] = [];
  if (!config.near.masterAccountId) missing.push("NEAR_MASTER_ACCOUNT_ID");
  if (!config.near.masterPrivateKey) missing.push("NEAR_MASTER_PRIVATE_KEY");
  if (!missing.length) return undefined;
  return `Testnet mode: missing variable(s): ${missing.join(", ")}. Copy .env.example to .env and fill them in (see the README, section "Run it in testnet mode"). To try without a key: npm run start:mock.`;
}
