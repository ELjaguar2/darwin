#!/usr/bin/env node
// Reads a Darwin journal (JSONL, read-only) and prints a Markdown table of its real subcontracts.
// Automatic checks per integrated subcontract: payer of the child escrow lock = account of the delegating agent;
// child release goes to the child agent; parent release goes to the delegating agent; commission = parent price - child price.
// Usage: node scripts/subcontract-proof.mjs <journal.jsonl>      (exit code 1 if a check fails)
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const NEAR = 10n ** 24n;
export function fmtNear(yocto) {
  if (yocto == null) return "?"; // older journals (run 8) do not record every field
  const y = BigInt(yocto);
  const tenThousandths = (y * 10000n) / NEAR; // 4 decimals
  return `${tenThousandths / 10000n}.${String(tenThousandths % 10000n).padStart(4, "0")}`;
}

export function parseJournal(text) {
  return text.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}

export function analyze(events) {
  const accounts = new Map(); // agentId -> accountId
  const names = new Map();
  const tasks = new Map(); // taskId -> {profession, requester}
  const locks = new Map();
  const releases = new Map();
  const refunds = new Map();
  const verdicts = new Map();
  const created = new Map();
  const integrated = new Map();
  const fallbacks = new Map();
  for (const e of events) {
    const d = e.data ?? {};
    switch (e.type) {
      case "agent.born": accounts.set(d.agent.id, d.agent.accountId); names.set(d.agent.id, d.agent.name); break;
      case "task.posted": tasks.set(d.task.id, { profession: d.task.profession, requester: d.task.requester?.kind }); break;
      case "escrow.locked": locks.set(d.taskId, d); break;
      case "escrow.released": releases.set(d.taskId, d); break;
      case "escrow.refunded": refunds.set(d.taskId, d); break;
      case "task.validated": verdicts.set(d.taskId, d.validation); break;
      case "subcontract.created": created.set(d.parentTaskId, d); break;
      case "subcontract.integrated": integrated.set(d.parentTaskId, d); break;
      case "subcontract.fallback": fallbacks.set(d.parentTaskId, d); break;
      default:
    }
  }
  const short = (id) => (names.get(id) ?? id ?? "?").replace(/-\d+$/, "");
  const rows = [];
  for (const [parent, c] of created) {
    const inte = integrated.get(parent);
    const fb = fallbacks.get(parent);
    const child = c.childTaskId;
    const delegatorAcc = accounts.get(c.byAgentId);
    const lock = locks.get(child);
    const rel = releases.get(child);
    const prel = releases.get(parent);
    const pv = verdicts.get(parent);
    const checks = [];
    if (inte) {
      checks.push(["child lock payer = delegating agent's account", !!lock && !!delegatorAcc && lock.payer === delegatorAcc]);
      checks.push(["child release payee = child agent's account", !!rel && rel.payee === accounts.get(inte.childAgentId)]);
      checks.push(["commission = parent price - child price", BigInt(inte.commission) === BigInt(inte.parentPrice) - BigInt(inte.childPrice)]);
      if (prel) checks.push(["parent release payee = delegating agent's account", prel.payee === delegatorAcc]);
    }
    rows.push({
      parent, child, parentProfession: tasks.get(parent)?.profession, childProfession: c.profession,
      requester: tasks.get(parent)?.requester,
      delegator: c.byAgentId, delegatorName: short(c.byAgentId), childAgent: inte?.childAgentId, childAgentName: short(inte?.childAgentId),
      parentPrice: c.parentPrice, childPrice: inte?.childPrice ?? null,
      commission: inte ? inte.commission : fb ? fb.commission : null,
      status: fb ? `fallback (${fb.reason})` : inte ? "integrated" : "created only",
      verdict: pv ? `${pv.verdict} ${Number(pv.score).toFixed(2)}` : "n/a",
      parentPaid: !!prel, parentRefunded: refunds.has(parent),
      complete: !!inte && pv?.verdict === "accepted" && !!prel,
      classification: fb ? "fallback (in-house, no commission)"
        : inte && pv?.verdict === "accepted" && !!prel ? "complete (parent accepted and paid)"
        : inte ? "integrated but parent rejected (no commission, delegator lost the child price)" : "created only",
      earned: inte && pv?.verdict === "accepted" && !!prel ? inte.commission : "0",
      lockTx: lock?.tx, lockPayer: lock?.payer, childReleaseTx: rel?.tx, parentReleaseTx: prel?.tx, checks,
    });
  }
  return rows;
}

export function render(rows) {
  const L = [];
  L.push("| Parent -> child | Professions | Delegating agent | Agent paid | Parent price | Child price | Commission planned | Commission earned | Classification; parent verdict; parent outcome | Child lock tx (payer) | Child release tx | Parent release tx |");
  L.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of rows) {
    const outcome = r.parentPaid ? "paid" : r.parentRefunded ? "refunded to client" : "not paid";
    L.push(`| ${r.parent} -> ${r.child} | ${r.parentProfession} -> ${r.childProfession} | ${r.delegatorName} (${r.delegator}) | ${r.childAgent ? `${r.childAgentName} (${r.childAgent})` : "-"} | ${fmtNear(r.parentPrice)} NEAR | ${r.childPrice ? fmtNear(r.childPrice) + " NEAR" : "-"} | ${r.commission != null ? fmtNear(r.commission) + " NEAR" : "-"} | ${fmtNear(r.earned)} NEAR | ${r.classification}; ${r.verdict}; ${outcome} | ${r.lockTx ? `\`${r.lockTx}\` (${r.lockPayer?.split(".")[0]})` : "-"} | ${r.childReleaseTx ? `\`${r.childReleaseTx}\`` : "-"} | ${r.parentReleaseTx ? `\`${r.parentReleaseTx}\`` : "-"} |`);
  }
  const failed = rows.flatMap((r) => r.checks.filter((c) => !c[1]).map((c) => `${r.parent}: ${c[0]}`));
  const nChecks = rows.reduce((n, r) => n + r.checks.length, 0);
  L.push("");
  L.push(`Subcontracts created: ${rows.length}; integrated: ${rows.filter((r) => r.status === "integrated").length}; fallback: ${rows.filter((r) => r.status.startsWith("fallback")).length}; complete (integrated, parent accepted and paid): ${rows.filter((r) => r.complete).length}.`);
  const sum = (xs) => xs.reduce((a, x) => a + BigInt(x), 0n);
  const paidKids = rows.filter((r) => r.childPrice && r.childReleaseTx);
  L.push(`Commission actually earned (accepted and paid parents only): ${fmtNear(sum(rows.map((r) => r.earned)))} NEAR; paid to child agents: ${fmtNear(sum(paidKids.map((r) => r.childPrice)))} NEAR (${paidKids.length} children). A rejected parent earns nothing: its planned commission is never collected.`);
  L.push(`Automatic checks: ${nChecks - failed.length}/${nChecks} passed${failed.length ? "; FAILED: " + failed.join("; ") : ""}.`);
  return { markdown: L.join("\n"), failed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) { console.error("Usage: node scripts/subcontract-proof.mjs <journal.jsonl>"); process.exit(2); }
  const { markdown, failed } = render(analyze(parseJournal(readFileSync(file, "utf8"))));
  console.log(markdown);
  process.exit(failed.length ? 1 : 0);
}
