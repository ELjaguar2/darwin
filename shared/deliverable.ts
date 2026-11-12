// Deliverable actually produced for a task (lot L16). Contract shared by market/, backend/ and frontend/.
import type { Profession } from "./types.ts";

export interface DeliverableFile {
  /** Safe file name: [a-z0-9._-]{1,64}, e.g. "logo-1.svg", "architecture.md", "schema.mmd". Stable protocol identifier (not translated). */
  name: string;
  /** "image/svg+xml" | "text/markdown" | "text/plain" | "text/vnd.mermaid" */
  mime: string;
  content: string;
  /** True if the content was cut (journal bounds, see `journalFiles`). Absent = complete. */
  truncated?: boolean;
}

/** File as written in `deliverable.produced` (journal, SSE stream). `content` and `truncated` are optional: old journals = name/mime/size only. */
export interface DeliverableJournalFile {
  name: string;
  mime: string;
  /** Real UTF-8 size in bytes of the complete file (even if `content` is truncated). */
  bytes: number;
  /** PUBLIC content (text, already sanitised SVG, Markdown), bounded. */
  content?: string;
  truncated?: boolean;
}

/** Bounds of the content embedded in the journal: per file, then per deliverable (sum of the files). */
export const JOURNAL_MAX_FILE_CHARS = 24_000;
export const JOURNAL_MAX_DELIVERABLE_CHARS = 64_000;

const utf8 = (s: string) => new TextEncoder().encode(s).length;

/** Files of a deliverable for the journal: real size + bounded content (`truncated: true` if cut). Never splits a surrogate pair. */
export function journalFiles(files: readonly { name: string; mime: string; content: string }[]): DeliverableJournalFile[] {
  let left = JOURNAL_MAX_DELIVERABLE_CHARS;
  return files.map((f) => {
    const room = Math.max(0, Math.min(JOURNAL_MAX_FILE_CHARS, left));
    let content = f.content;
    let truncated = false;
    if (content.length > room) {
      let end = room;
      const c = end > 0 ? content.charCodeAt(end - 1) : 0;
      if (c >= 0xd800 && c <= 0xdbff) end--;
      content = content.slice(0, end);
      truncated = true;
    }
    left -= content.length;
    return { name: f.name, mime: f.mime, bytes: utf8(f.content), content, ...(truncated ? { truncated: true } : {}) };
  });
}

export interface Deliverable {
  taskId: string;
  profession: Profession;
  agentId: string;
  files: DeliverableFile[];
  /** Raw text returned by the agent (proof: sha256 = resultHash of the validation). */
  rawText: string;
  resultHash: string;
  /** AI production cost (agent) in USD, journal `brain.charged`; the judge cost is separate. */
  productionCostUsd: number;
  judgeCostUsd: number;
  createdAt: string;
  /** Set after validation. */
  verdict?: "accepted" | "rejected";
  score?: number;
}

/** A market event changes the demand for a profession between `startTick` and `endTick`. */
export interface MarketEvent {
  id: string; // "e-0001"
  title: string; // "Startup fair: everybody wants a logo" (English display text)
  profession: Profession;
  /** Demand multiplier (>1 up, <1 down), applied to the simulated client's rate. */
  demandMultiplier: number;
  startTick: number;
  endTick: number;
}
