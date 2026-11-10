// `npm run ai:usage-report [-- --dir data] [--last 15]` : section Markdown « consommation IA réelle » à coller dans docs/PREUVES_TESTNET.md.
// Source : data/ai-usage.jsonl (une ligne par appel facturé). Aucune clé n'y figure.
import { join } from "node:path";
import { USAGE_FILE, readUsage, type UsageRecord } from "../budget.ts";

export function usageReport(recs: readonly UsageRecord[], opts: { last?: number; stopEur?: number; totalEur?: number } = {}): string {
  const last = opts.last ?? 15;
  const sum = (f: (r: UsageRecord) => number, rs: readonly UsageRecord[] = recs) => rs.reduce((n, r) => n + f(r), 0);
  const fmt = (n: number, d = 6) => n.toFixed(d);
  const lines: string[] = ["## Consommation IA réelle (NEAR AI Cloud)", ""];
  if (recs.length === 0) {
    lines.push("Aucun appel facturé enregistré (`data/ai-usage.jsonl` absent ou vide) : la simulation a tourné en mode mock.", "");
    return lines.join("\n");
  }
  const rate = recs[recs.length - 1]!.eurUsdRate;
  lines.push(
    `Journal : \`data/ai-usage.jsonl\` (${recs.length} appels, du ${recs[0]!.ts} au ${recs[recs.length - 1]!.ts}). Coût = tokens \`usage\` x prix du catalogue \`GET /v1/model/list\` ; EUR = USD / ${rate} (taux configuré \`DARWIN_EUR_USD_RATE\`, prudent).`,
    "",
    "| Total | Valeur |", "|---|---|",
    `| Appels | ${recs.length} |`,
    `| Tokens d'entrée | ${sum((r) => r.promptTokens)} |`,
    `| Tokens de sortie | ${sum((r) => r.completionTokens)} (dont raisonnement ${sum((r) => r.reasoningTokens)}) |`,
    `| Coût USD | ${fmt(sum((r) => r.costUsd))} |`,
    `| Coût EUR | ${fmt(sum((r) => r.costEur))} |`,
  );
  if (opts.stopEur) lines.push(`| Plafond d'arrêt / budget total | ${opts.stopEur} EUR / ${opts.totalEur ?? "?"} EUR |`);
  lines.push("", "### Par modèle", "", "| Modèle | Fournisseur | Appels | Tokens in | Tokens out | USD | EUR |", "|---|---|---|---|---|---|---|");
  const byModel = new Map<string, UsageRecord[]>();
  for (const r of recs) byModel.set(`${r.model}|${r.provider}`, [...(byModel.get(`${r.model}|${r.provider}`) ?? []), r]);
  for (const [k, rs] of [...byModel].sort((a, b) => sum((r) => r.costUsd, b[1]) - sum((r) => r.costUsd, a[1]))) {
    const [model, provider] = k.split("|");
    lines.push(`| ${model} | ${provider} | ${rs.length} | ${sum((r) => r.promptTokens, rs)} | ${sum((r) => r.completionTokens, rs)} | ${fmt(sum((r) => r.costUsd, rs))} | ${fmt(sum((r) => r.costEur, rs))} |`);
  }
  lines.push("", `### ${Math.min(last, recs.length)} derniers appels`, "", "| Horodatage (UTC) | Modèle | In | Out | USD | Agent | Usage | Id de réponse |", "|---|---|---|---|---|---|---|---|");
  for (const r of recs.slice(-last)) {
    lines.push(`| ${r.ts} | ${r.model} | ${r.promptTokens} | ${r.completionTokens} | ${fmt(r.costUsd)} | ${r.agentId} | ${r.purpose} | \`${r.responseId ?? "-"}\` |`);
  }
  lines.push("");
  return lines.join("\n");
}

if (process.argv[1] && /usage-report\.ts$/.test(process.argv[1].replace(/\\/g, "/"))) {
  const args = process.argv.slice(2);
  const arg = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
  const dir = arg("dir") ?? process.env.DARWIN_DATA_DIR ?? "data";
  const num = (v: string | undefined) => (v && Number.isFinite(Number(v)) ? Number(v) : undefined);
  console.log(usageReport(readUsage(join(dir, USAGE_FILE)), {
    last: num(arg("last")),
    stopEur: num(process.env.DARWIN_AI_BUDGET_EUR_STOP) ?? 8,
    totalEur: num(process.env.DARWIN_AI_BUDGET_EUR_TOTAL) ?? 10,
  }));
}
