import { describe, it, expect } from "vitest";
import { idOffset } from "./runtime.ts";

const at = (iso: string) => () => new Date(iso);

describe("idOffset (automatic id offset)", () => {
  it("mock: 0 without a variable", () => {
    expect(idOffset("X", "mock", 10, at("2026-11-10T12:00:00Z"), {})).toBe(0);
  });
  it("explicit variable: takes priority, even on the real chain", () => {
    expect(idOffset("X", "near", 10, at("2026-11-10T12:00:00Z"), { X: "700" })).toBe(700);
  });
  it("real chain: grows with the clock, two runs 5 minutes apart do not overlap", () => {
    const a = idOffset("X", "near", 0.25, at("2026-11-10T12:00:00Z"), {});
    const b = idOffset("X", "near", 0.25, at("2026-11-10T12:05:00Z"), {});
    expect(a).toBeGreaterThan(0);
    expect(b - a).toBe(75); // 300 s x 0,25
    expect(idOffset("X", "near", 10, at("2026-11-10T12:05:00Z"), {}) - idOffset("X", "near", 10, at("2026-11-10T12:00:00Z"), {})).toBe(3000);
  });
});
