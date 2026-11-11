// Lot L18 : assainissement et pitch mock, bornes du contenu des livrables dans le journal.
import { describe, expect, it } from "vitest";
import {
  JOURNAL_MAX_DELIVERABLE_CHARS, JOURNAL_MAX_FILE_CHARS, MAX_PITCH_CHARS, PROFESSIONS, detectLanguage, journalFiles, mockPitch, pitchLanguageOk, sanitizePitch,
} from "./index.ts";

const g = (profession: (typeof PROFESSIONS)[number], personality: string, risk = 0.5, cooperation = 0.5, askRatio = 0.7) => ({ profession, personality, risk, cooperation, askRatio });

describe("sanitizePitch", () => {
  it("une seule ligne, sans HTML ni Markdown ni délimiteurs de prompt", () => {
    const raw = '  **Je** livre `vite`.\n\n# Titre\n- <script>alert(1)</script>un [lien](http://x.y) <<<TACHE>>>\r\n"fin"  ';
    const p = sanitizePitch(raw);
    expect(p).not.toMatch(/[\n\r<>`*#]|\]\(/);
    expect(p).toContain("Je livre vite.");
    expect(p).toContain("un lien");
    expect(p.startsWith('"')).toBe(false);
  });
  it("tronque proprement à 240 caractères, au mot, avec une ellipse ; idempotent", () => {
    const long = "mot ".repeat(200);
    const p = sanitizePitch(long);
    expect(p.length).toBeLessThanOrEqual(MAX_PITCH_CHARS);
    expect(p.endsWith("…")).toBe(true);
    expect(p).not.toMatch(/mo…$|\s…$/);
    expect(sanitizePitch(p)).toBe(p);
    expect(sanitizePitch("x".repeat(500)).length).toBeLessThanOrEqual(MAX_PITCH_CHARS);
  });
  it("entrées non textuelles ou vides : chaîne vide ; un délimiteur ne se recompose pas", () => {
    for (const bad of [undefined, null, 42, {}, "", "   ", "<<<>>>"]) expect(sanitizePitch(bad)).toBe("");
    expect(sanitizePitch("a <<<>>><< b")).not.toMatch(/[<>]/);
  });
});

describe("langue", () => {
  it("détecte le français et l'anglais, indécidable sur du court", () => {
    expect(detectLanguage("Je peux le faire pour vous et dans les délais de la semaine.")).toBe("fr");
    expect(detectLanguage("I can do this for you and deliver it in the time that you need.")).toBe("en");
    expect(detectLanguage("Logo")).toBeUndefined();
  });
  it("un pitch dans la mauvaise langue est refusé, vide aussi", () => {
    const fr = "Rédige une accroche pour le lancement de notre café et de la boutique dans le quartier.";
    expect(pitchLanguageOk("I will write a warm hook for your café and deliver it to you.", fr)).toBe(false);
    expect(pitchLanguageOk("Une accroche chaleureuse pour votre café, livrée dans les temps.", fr)).toBe(true);
    expect(pitchLanguageOk("", fr)).toBe(false);
  });
});

describe("mockPitch", () => {
  const task = { id: "t-1", title: "Mission logo", prompt: "Crée trois propositions de logo pour une boutique de thé." };
  it("déterministe, borné, sans retour ligne", () => {
    for (const prof of PROFESSIONS) {
      const p = mockPitch(g(prof, "Sérieux."), task);
      expect(p).toBe(mockPitch(g(prof, "Sérieux."), task));
      expect(p.length).toBeGreaterThan(20);
      expect(p.length).toBeLessThanOrEqual(MAX_PITCH_CHARS);
      expect(p).not.toMatch(/[\n\r<>`*]/);
    }
  });
  it("varié : des génomes différents ne tiennent pas tous le même discours", () => {
    const set = new Set<string>();
    for (let i = 0; i < 24; i++) set.add(mockPitch(g("logo", `Perso ${i}`, (i % 10) / 10, (i % 7) / 7, 0.5 + i / 100), { ...task, id: `t-${i}` }));
    expect(set.size).toBeGreaterThanOrEqual(8);
  });
  it("suit la langue de la tâche (anglais si la tâche est en anglais)", () => {
    const en = mockPitch(g("translation", "Fidèle."), { id: "t-9", title: "Translation", prompt: "Please translate this sentence into French and keep the tone of the original for our team." });
    expect(detectLanguage(en)).toBe("en");
    const fr = mockPitch(g("translation", "Fidèle."), { id: "t-9", title: "Traduction", prompt: "Traduis cette phrase en anglais et garde le ton de l'original pour notre équipe." });
    expect(detectLanguage(fr)).toBe("fr");
  });
});

describe("journalFiles : contenu borné et public", () => {
  it("petit fichier : contenu complet, taille UTF-8 réelle, pas de drapeau", () => {
    const [f] = journalFiles([{ name: "a.md", mime: "text/markdown", content: "é€ ok" }]);
    expect(f).toEqual({ name: "a.md", mime: "text/markdown", bytes: 8, content: "é€ ok" });
    expect(f!.truncated).toBeUndefined();
  });
  it("24 000 caractères par fichier avec truncated ; bytes = taille du fichier complet", () => {
    const [f] = journalFiles([{ name: "a.md", mime: "text/markdown", content: "x".repeat(30_000) }]);
    expect(f!.content!.length).toBe(JOURNAL_MAX_FILE_CHARS);
    expect(f!.truncated).toBe(true);
    expect(f!.bytes).toBe(30_000);
  });
  it("64 000 caractères par livrable : les derniers fichiers sont coupés ou vides, jamais omis", () => {
    const files = [1, 2, 3, 4].map((i) => ({ name: `f${i}.md`, mime: "text/markdown", content: "y".repeat(JOURNAL_MAX_FILE_CHARS) }));
    const out = journalFiles(files);
    expect(out).toHaveLength(4);
    expect(out.reduce((n, f) => n + f.content!.length, 0)).toBe(JOURNAL_MAX_DELIVERABLE_CHARS);
    expect(out.map((f) => !!f.truncated)).toEqual([false, false, true, true]);
    expect(out[3]!.content).toBe("");
  });
  it("ne coupe pas une paire de substitution", () => {
    const [f] = journalFiles([{ name: "a.md", mime: "text/markdown", content: "a".repeat(JOURNAL_MAX_FILE_CHARS - 1) + "😀😀" }]);
    expect(f!.content!.length).toBe(JOURNAL_MAX_FILE_CHARS - 1);
  });
});
