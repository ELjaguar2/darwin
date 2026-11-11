// L17 : la réponse brute RÉELLE de NEAR AI (docs/preuves/logo-validation, un seul appel) passe l'extraction et les contrôles du marché.
// Aucun appel réseau : la réponse est un fichier du dépôt.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATALOGUE } from "../shared/index.ts";
import { runChecks } from "../market/checks.ts";
import { extractDeliverable } from "../market/deliverable.ts";

const dir = new URL("../docs/preuves/logo-validation/", import.meta.url);
const raw = readFileSync(new URL("reponse-brute.txt", dir), "utf8");
const meta = JSON.parse(readFileSync(new URL("meta.json", dir), "utf8"));
const task = { id: "t-1", profession: "logo" as const, prompt: "Entreprise : Atelier Lumio" };

describe("réponse réelle du logo (preuve L17)", () => {
  it("n'est pas tronquée : finish_reason stop, sous le plafond du métier", () => {
    expect(meta.finishReason).toBe("stop");
    expect(meta.maxTokensSent).toBe(CATALOGUE.logo.maxOutputTokens);
    expect(meta.usage.completion_tokens).toBeLessThan(meta.maxTokensSent);
    expect(meta.costUsd).toBeLessThan(0.05);
  });
  it("donne 3 SVG valides acceptés par extractDeliverable et runChecks", () => {
    const d = extractDeliverable(task, "a-1", raw);
    expect(d.files.map((f) => f.name)).toEqual(["logo-1.svg", "logo-2.svg", "logo-3.svg"]);
    expect(runChecks(task, d).ok).toBe(true);
  });
  it("une troncature à 300 tokens serait détectée (rejet, pas de réparation)", () => {
    expect(() => extractDeliverable(task, "a-1", raw.slice(0, 1100))).toThrow();
  });
});
