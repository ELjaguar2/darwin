// L19: everything the agents generate is in English. Prompts carry the explicit rule, mock texts are English.
import { describe, expect, it } from "vitest";
import { MockBrain, PROFESSIONS, type ChatMessage } from "../shared/index.ts";
import { FR_WORDS, looksEnglish, words } from "./english-check.ts";
import {
  ENGLISH_RULE, bidMessages, decisionMessages, executeMessages, letterMessages, mutateMessages, parseVerdict, systemPrompt, validateMessages,
} from "./prompts.ts";

const g = { personality: "You are a freelance translator.", profession: "translation" as const, risk: 0.4, askRatio: 0.6 };
const FOREIGN_TASK = { title: "Traduire", prompt: "Rédige une présentation de notre entreprise pour nos clients.", budgetNear: "1" };

describe("every generation prompt carries the English rule", () => {
  const sets: [string, ChatMessage[]][] = [
    ["bid", bidMessages(g, FOREIGN_TASK, "0.01")],
    ["decision", decisionMessages(g, { balanceNear: "1", minVitalNear: "0.1", options: "x" })],
    ["validate", validateMessages(FOREIGN_TASK, "some result")],
    ["letter", letterMessages(g, { parentName: "Ada", childName: "Blaise", generation: 2, lessons: "tasks: 3" })],
    ["mutate", mutateMessages(g)],
    ["system", [{ role: "system", content: systemPrompt(g) }]],
    ...PROFESSIONS.map((p): [string, ChatMessage[]] => [`execute:${p}`, executeMessages(g, { title: "t", prompt: "p", profession: p })]),
  ];
  for (const [name, msgs] of sets) {
    it(`${name}: system message contains "Always answer in English."`, () => {
      expect(ENGLISH_RULE).toBe("Always answer in English.");
      expect(msgs[0]!.role).toBe("system");
      expect(msgs[0]!.content).toContain("Always answer in English.");
      // The execute prompts embed the catalogue instructions (shared/catalogue.ts, translated by the market owner): rule check only.
      if (!name.startsWith("execute:")) expect(looksEnglish(msgs[0]!.content)).toBe(true);
    });
  }

  it("the bid prompt no longer asks for the task language", () => {
    const sys = bidMessages(g, FOREIGN_TASK, "0.01")[0]!.content;
    expect(sys).not.toMatch(/langue de la t/i);
    expect(sys).toMatch(/English even if the task is in another language/);
  });
});

describe("MockBrain texts are English", () => {
  it("letter, bid, mutate and default results", async () => {
    const brain = new MockBrain();
    const model = await brain.defaultModel();
    for (const purpose of ["letter", "bid", "mutate", "execute_task"] as const) {
      const r = await brain.complete({ agentId: "a-1", purpose, model, messages: [{ role: "user", content: "hello" }] });
      expect(r.text.startsWith("[mock] ")).toBe(true);
      expect(/[éèàêôùç]/i.test(r.text)).toBe(false);
      expect(words(r.text.replace(/\(.*\)/, "")).filter((x) => FR_WORDS.includes(x))).toEqual([]);
    }
    const letter = await brain.complete({ agentId: "a-1", purpose: "letter", model, messages: [{ role: "user", content: "x" }] });
    expect(letter.text).toMatch(/^\[mock\] Dear child/);
    expect(looksEnglish(letter.text)).toBe(true);
  });

  it("the verdict parser still reads the historical and the English format", () => {
    expect(parseVerdict("ACCEPTED score=0.8 raison=ok").verdict).toBe("accepted");
    expect(parseVerdict("REJECTED score=0.1 reason=too short")).toMatchObject({ verdict: "rejected", reason: "too short" });
    expect(parseVerdict("???").reason).toBe("unparseable verdict");
  });
});
