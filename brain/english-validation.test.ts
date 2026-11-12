// Offline replay of the real NEAR AI answers recorded by `npm run ai:english-validation` (docs/preuves/english-validation/*.json).
// No network: re-evaluates language, finish_reason, prompts (English rule) and the market checks on the saved raw responses.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ENGLISH_REFERENCE } from "../engine/pitch.ts";
import { MAX_PITCH_CHARS, pitchLanguageOk, sanitizePitch } from "../shared/index.ts";
import { extractDeliverable } from "../market/deliverable.ts";
import { runChecks } from "../market/checks.ts";
import { englishVerdict, languageReport } from "./english-check.ts";

const load = (n: string) => JSON.parse(readFileSync(new URL(`../docs/preuves/english-validation/${n}.json`, import.meta.url), "utf8"));
const FR = { title: "Accroche pour mon café", prompt: "Rédige une accroche et un court texte de présentation pour mon petit café de quartier, ton chaleureux, avec un appel à l'action pour venir goûter notre nouveau cappuccino." };

describe("recorded real outputs are English", () => {
  for (const step of ["letter", "pitch", "deliverable"]) {
    it(`${step}: English prompt, finish_reason=stop, English text, secret-free`, () => {
      const r = load(step);
      expect(r.requestMessages[0].content).toContain("Always answer in English.");
      expect(r.finishReason).toBe("stop");
      expect(r.usage.completion_tokens).toBeLessThanOrEqual(r.maxTokensSent);
      expect(englishVerdict(r.checkedText, step === "pitch")).toBe(true);
      expect(languageReport(r.checkedText).frenchWords).toEqual([]);
      expect(JSON.stringify(r)).not.toMatch(/Bearer|api[_-]?key|sk-[A-Za-z0-9]{10,}/i);
    });
  }
  it("pitch for a French task: sanitized, accepted by pitchLanguageOk, not French", () => {
    const r = load("pitch");
    expect(r.requestMessages[1].content).toContain("café");
    const p = sanitizePitch(r.text, MAX_PITCH_CHARS);
    expect(pitchLanguageOk(p, ENGLISH_REFERENCE)).toBe(true);
    expect(p).toBe(r.sanitized);
  });
  it("deliverable for a French order: extraction and market checks pass on the raw answer", () => {
    const r = load("deliverable");
    const task = { id: "t-replay", profession: "marketing" as const, ...FR };
    const d = extractDeliverable(task, "replay", r.text);
    expect(runChecks(task, d).ok).toBe(true);
    expect(englishVerdict(d.files.map((f) => f.content).join("\n"))).toBe(true);
  });
  it("the verdict rejects a French pitch", () => {
    expect(englishVerdict("Une accroche chaleureuse pour votre café.", true)).toBe(false);
  });
});
