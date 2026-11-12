// L21 subcontracting plan: which profession an agent delegates to, how the brief of the sub-task is DERIVED from the client's mission
// (and from the parent's own partial result), and how the child's deliverable is integrated into the parent's final deliverable.
// Pure functions: no side effect, no model call. The briefs are valid for the child profession (market checks: translation with a
// source text between « », a figures table for finance, a checklist request for legal...). All text is English.
import { LEGAL_DISCLAIMER } from "../shared/catalogue.ts";
import { sha256Hex, type Profession } from "../shared/index.ts";
import { translationBody } from "../market/checks.ts";

export interface ParentBrief {
  title: string;
  prompt: string;
  /** The parent's own result (its share of the work), already produced when the sub-task is posted. */
  ownText: string;
}

export interface ChildBrief {
  title: string;
  prompt: string;
}

export interface PlanRow {
  child: Profession;
  /** What the sub-task contributes to the final deliverable (documented in the README). */
  contribution: string;
  brief(parentId: string, p: ParentBrief): ChildBrief;
}

/** Ticks kept between the end of the sub-task and the parent's own deadline (time to integrate and submit). */
export const INTEGRATION_MARGIN_TICKS = 1;

// ---------- text helpers ----------
const MAX_TITLE = 120;
/** Plain single-line-ish text: no Markdown marks, no code fence, no « » (reserved as source delimiters). */
export function plain(text: string): string {
  return text.replace(/```[a-z]*/gi, " ").replace(/[#*_>`|]/g, " ").replace(/[«»]/g, '"').replace(/\s+/g, " ").trim();
}
/** Cut at a sentence (or word) boundary, at most `max` characters. */
export function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const stop = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
  if (stop >= max * 0.5) return head.slice(0, stop + 1);
  const sp = head.lastIndexOf(" ");
  return (sp > 0 ? head.slice(0, sp) : head).trim();
}
const titleFor = (parentId: string, child: Profession) => `Subcontract of ${parentId}: ${child} sub-task`.slice(0, MAX_TITLE);
const field = (prompt: string, name: string) => new RegExp(`${name}\\s*:\\s*([^\\n]+)`, "i").exec(prompt)?.[1]?.trim();
const pad = (s: string, min: number, filler: string) => (s.length >= min ? s : `${s} ${filler}`);

function costTable(seed: string): string {
  const h = sha256Hex(seed);
  const n = (i: number, lo: number, hi: number, step: number) => lo + (parseInt(h.slice(i * 4, i * 4 + 4), 16) % (Math.floor((hi - lo) / step) + 1)) * step;
  const rows: [string, number][] = [
    ["Hosting", n(0, 60, 300, 10)], ["Database", n(1, 40, 200, 10)], ["Monitoring", n(2, 10, 60, 5)], ["Developer time", n(3, 400, 1200, 50)],
  ];
  return ["| Item | Monthly cost (EUR) |", "|---|---|", ...rows.map(([k, v]) => `| ${k} | ${v} |`)].join("\n");
}

/**
 * Splitting table: profession of the mission -> profession of the sub-task. Chosen so that the child's price floor always fits under
 * the parent's price with a commission (catalogue prices: logo 0.045, finance 0.036, architecture 0.06, marketing 0.024, translation 0.012,
 * legal 0.045 NEAR). `finance -> legal` of the first draft was replaced by `finance -> marketing`: a legal checklist (0.045) does not fit under a
 * finance mission (0.036 to 0.054). `translation -> marketing` only applies when the translation order pays at least ~0.03 NEAR.
 */
export const SUBCONTRACT_PLAN: Record<Profession, PlanRow> = {
  marketing: {
    child: "translation",
    contribution: "Spanish translation of the marketing text",
    brief: (id, p) => ({
      title: titleFor(id, "translation"),
      prompt: `Translate into Spanish: « ${pad(cut(plain(p.ownText), 320), 30, "Discover our products, made with care for your everyday life.")} »`,
    }),
  },
  logo: {
    child: "marketing",
    contribution: "slogan and short brand text for the company",
    brief: (id, p) => {
      const company = plain(field(p.prompt, "Company") ?? p.title.replace(/^Logo for\s*/i, "")).slice(0, 60) || "the company";
      const sector = field(p.prompt, "Sector");
      const style = field(p.prompt, "Desired style");
      return {
        title: titleFor(id, "marketing"),
        prompt: `Write a short slogan and a brand text of 60 to 90 words (at least 150 characters) for the fictional company ${company}${sector ? `, sector: ${plain(sector).slice(0, 60)}` : ""}${style ? `. Tone: ${plain(style).slice(0, 40)}` : ""}. Plain text only: no code, no logo drawing.`,
      };
    },
  },
  architecture: {
    child: "finance",
    contribution: "monthly cost estimate of the proposed system",
    brief: (id, p) => ({
      title: titleFor(id, "finance"),
      prompt: `Estimate the running costs of this system: ${cut(plain(p.prompt.split(/\bConstraint\b/i)[0] ?? p.prompt), 180)}\n\nIllustrative monthly figures (euros):\n\n${costTable(p.title + p.prompt)}\n\nAnalyse the cost structure: total, share of each item, the largest cost. Use only these figures.`,
    }),
  },
  finance: {
    child: "marketing",
    contribution: "plain-language summary of the figures for the business owner",
    brief: (id, p) => ({
      title: titleFor(id, "marketing"),
      prompt: `Write a plain-language summary of 80 to 120 words (at least 150 characters) for the owner of a small business, based on this financial analysis: « ${pad(cut(plain(p.ownText), 450), 40, "Revenue and costs were reviewed over the period.")} ». Warm tone, one clear recommendation.`,
    }),
  },
  legal: {
    child: "marketing",
    contribution: "plain-language client summary of the checklist",
    brief: (id, p) => ({
      title: titleFor(id, "marketing"),
      prompt: `Write a client summary of 80 to 120 words (at least 150 characters) of this legal checklist, for a non-lawyer: « ${pad(cut(plain(p.ownText.split(LEGAL_DISCLAIMER).join(" ")), 450), 40, "Check the status, contracts and personal data of the activity.")} ». Reassuring tone.`,
    }),
  },
  translation: {
    child: "marketing",
    contribution: "tone review of the translation",
    brief: (id, p) => ({
      title: titleFor(id, "marketing"),
      prompt: `Write a short tone review (60 to 90 words, at least 150 characters) of this English translation, saying whether it sounds warm and clear and suggesting one improvement: « ${pad(cut(plain(translationBody(p.ownText)), 350), 30, "Thank you for your order, it will be shipped soon.")} »`,
    }),
  },
};

// ---------- integration ----------
/** Heading of the section holding the child's work. `agentName` like "Ada-3" gives "Ada". */
export const subcontractHeading = (agentName: string, profession: Profession) => `## Subcontracted to ${agentName.split("-")[0]} (${profession})`;
export const inHouseHeading = (reason: string) => `## Done in-house (subcontract failed: ${reason})`;

/** Embedded text is untrusted: no code fence (it could add or break the parent's SVG/Mermaid blocks), bounded length. */
export function sanitizeEmbedded(text: string, max: number): string {
  // Any line starting with `#` is escaped: the child cannot forge or close the "## Subcontracted to ..." section of the parent.
  const t = text.replace(/```/g, "'''").replace(/^([ \t]*)#/gm, "$1\\#").trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}\n[...]` : t;
}

/**
 * Appends the section to the parent's own result, keeping every market check of the parent's profession valid:
 * - legal: the disclaimer must open AND close the document, so the section goes BEFORE the closing disclaimer;
 * - translation: the section goes after a `---` line (the checked translation body stops there);
 * - logo / others: appended after a `---` line (the three SVG blocks stay intact).
 */
export function integrateText(parentProfession: Profession, ownText: string, heading: string, body: string, maxTotal = 20_000): string {
  const own = ownText.trim();
  const room = Math.max(0, maxTotal - own.length - heading.length - LEGAL_DISCLAIMER.length - 40);
  const section = `${heading}\n\n${sanitizeEmbedded(body, Math.min(6_000, room))}`;
  if (parentProfession === "legal" && own.endsWith(LEGAL_DISCLAIMER)) {
    return `${own.slice(0, own.length - LEGAL_DISCLAIMER.length).trimEnd()}\n\n${section}\n\n${LEGAL_DISCLAIMER}`;
  }
  return `${own}\n\n---\n\n${section}`;
}
