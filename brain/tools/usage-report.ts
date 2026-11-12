// `npm run ai:usage-report [-- --dir data] [--last 15]` : "real AI consumption" Markdown section to paste into docs/PREUVES_TESTNET.md.
// Source: data/ai-usage.jsonl (one line per billed call). No key appears in it.
import { join } from "node:path";
import { USAGE_FILE, readUsage, type UsageRecord } from "../budget.ts";

export function usageReport(recs: readonly UsageRecord[], opts: { last?: number; stopEur?: number; totalEur?: number } = {}): string {
  const last = opts.last ?? 15;
  const sum = (f: (r: UsageRecord) => number, rs: readonly UsageRecord[] = recs) => rs.reduce((n, r) => n + f(r), 0);
  const fmt = (n: number, d = 6) => n.toFixed(d);
  const lines: string[] = ["## Real AI consumption (NEAR AI Cloud)", ""];
  if (recs.length === 0) {
    lines.push("No billed call recorded (`data/ai-usage.jsonl` missing or empty): the simulation ran in mock mode.", "");
    return lines.join("\n");
  }
  const rate = recs[recs.length - 1]!.eurUsdRate;
  lines.push(
    `Journal: \`data/ai-usage.jsonl\` (${recs.length} calls, from ${recs[0]!.ts} to ${recs[recs.length - 1]!.ts}). Cost = \`usage\` tokens x catalogue price \`GET /v1/model/list\`; EUR = USD / ${rate} (configured rate \`DARWIN_EUR_USD_RATE\`, conservative).`,
    "",
    "| Total | Value |", "|---|---|",
    `| Calls | ${recs.length} |`,
    `| Input tokens | ${sum((r) => r.promptTokens)} |`,
    `| Output tokens | ${sum((r) => r.completionTokens)} (of which reasoning ${sum((r) => r.reasoningTokens)}) |`,
    `| Cost USD | ${fmt(sum((r) => r.costUsd))} |`,
    `| Cost EUR | ${fmt(sum((r) => r.costEur))} |`,
  );
  if (opts.stopEur) lines.push(`| Stop cap / total budget | ${opts.stopEur} EUR / ${opts.totalEur ?? "?"} EUR |`);
  lines.push("", "### By model", "", "| Model | Provider | Calls | Tokens in | Tokens out | USD | EUR |", "|---|---|---|---|---|---|---|");
  const byModel = new Map<string, UsageRecord[]>();
  for (const r of recs) byModel.set(`${r.model}|${r.provider}`, [...(byModel.get(`${r.model}|${r.provider}`) ?? []), r]);
  for (const [k, rs] of [...byModel].sort((a, b) => sum((r) => r.costUsd, b[1]) - sum((r) => r.costUsd, a[1]))) {
    const [model, provider] = k.split("|");
    lines.push(`| ${model} | ${provider} | ${rs.length} | ${sum((r) => r.promptTokens, rs)} | ${sum((r) => r.completionTokens, rs)} | ${fmt(sum((r) => r.costUsd, rs))} | ${fmt(sum((r) => r.costEur, rs))} |`);
  }
  lines.push("", `### ${Math.min(last, recs.length)} last calls`, "", "| Timestamp (UTC) | Model | In | Out | USD | Agent | Purpose | Response id |", "|---|---|---|---|---|---|---|---|");
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
