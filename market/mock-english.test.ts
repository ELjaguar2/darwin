// L19: mock deliverables of every profession are English and still pass the deterministic checks of the market.
import { describe, expect, it } from "vitest";
import { PROFESSIONS, createRng, detectLanguage, type Profession } from "../shared/index.ts";
import { mockDeliverable } from "../shared/mock/mock-deliverables.ts";
import { extractDeliverable, runChecks, simTemplate, targetLanguage, translationBody } from "./index.ts";

const FRENCH = /[àâçéèêëîïôûù]|\b(le|la|les|des|une|pour|votre|vous|avec|dans)\b/i;
const order = (p: Profession, seed: number) => {
  const tpl = simTemplate(p, createRng(seed));
  // the mock brain extracts the order text before calling mockDeliverable
  return { tpl, text: mockDeliverable(p, tpl.prompt) };
};

describe("mock deliverables are English and valid", () => {
  for (const p of PROFESSIONS) {
    it(`${p}: English text accepted by runChecks (12 seeds)`, () => {
      for (let seed = 1; seed <= 12; seed++) {
        const { tpl, text } = order(p, seed);
        const shown = p === "translation" ? text : text.replace(/<svg[\s\S]*?<\/svg>/g, "");
        expect(shown, `${p} ${seed}`).not.toMatch(p === "translation" ? /[àâçéèêëîïôûù]/ : FRENCH);
        const c = runChecks({ profession: p, prompt: tpl.prompt }, extractDeliverable({ id: "t", profession: p }, "a", text));
        expect(c.failures, `${p} ${seed}`).toEqual([]);
      }
    });
  }
  it("logos carry the company name of a `Company:` order, French labels still work as a fallback", () => {
    expect(mockDeliverable("logo", "Company: Studio Vernis\nSector: crafts")).toContain("Studio Vernis");
    expect(mockDeliverable("logo", JSON.stringify({ prompt: "Company: Blue Papyrus Bookshop\nSector: books" }))).toContain("Blue Papyrus Bookshop");
    expect(mockDeliverable("logo", "Entreprise : Atelier Lumio\nSecteur : conseil")).toContain("Atelier Lumio");
    expect(mockDeliverable("logo", "no name")).toContain("Atelier Mock");
  });
  it("translation: English by default (consistent with targetLanguage), French only when explicitly requested", () => {
    const src = "« Merci de votre patience, votre commande sera expédiée sous deux jours ouvrés. »";
    for (const prompt of [`Translate into English: ${src}`, `Traduis ce texte : ${src}`]) {
      expect(targetLanguage(prompt)).toBe("en");
      const body = translationBody(mockDeliverable("translation", prompt));
      expect(detectLanguage(body)).toBe("en");
    }
    const fr = mockDeliverable("translation", `Translate into French: « Thank you for your patience, your order will be shipped within two business days. »`);
    expect(detectLanguage(translationBody(fr))).toBe("fr");
    expect(fr).toContain("Note: fake translation");
  });
});
