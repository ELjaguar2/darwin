import { describe, expect, it } from "vitest";
import { loadConfig } from "../shared/index.ts";
import { checkNodeVersion, checkTestnetEnv, versionLt } from "./startup.ts";

describe("version de Node", () => {
  it("comparaison semver", () => {
    expect(versionLt("22.11.9", "22.12.0")).toBe(true);
    expect(versionLt("22.12.0", "22.12.0")).toBe(false);
    expect(versionLt("v22.17.1", "22.22.2")).toBe(true);
    expect(versionLt("24.0.0", "22.22.2")).toBe(false);
  });
  it("< 22.12 : refus (mock comme testnet)", () => {
    expect(checkNodeVersion("20.18.0", "mock").error).toMatch(/>= 22\.12\.0/);
    expect(checkNodeVersion("22.11.0", "testnet").error).toBeTruthy();
  });
  it("22.12 <= v < 22.22.2 : mock sans avertissement, testnet avec avertissement explicite", () => {
    expect(checkNodeVersion("22.17.1", "mock")).toEqual({});
    const t = checkNodeVersion("22.17.1", "testnet");
    expect(t.error).toBeUndefined();
    expect(t.warning).toMatch(/22\.22\.2/);
    expect(t.warning).toMatch(/near-api-js/);
  });
  it(">= 22.22.2 : rien à signaler", () => {
    expect(checkNodeVersion("22.22.2", "testnet")).toEqual({});
    expect(checkNodeVersion("24.1.0", "testnet")).toEqual({});
  });
});

describe("variables du mode testnet", () => {
  it("cite les variables manquantes par nom et renvoie vers .env.example et le README (pas BESOINS_HUMAIN)", () => {
    const m = checkTestnetEnv(loadConfig({ DARWIN_MODE: "testnet" }))!;
    expect(m).toContain("NEAR_MASTER_ACCOUNT_ID");
    expect(m).toContain("NEAR_MASTER_PRIVATE_KEY");
    expect(m).toContain(".env.example");
    expect(m).toContain("README");
    expect(m).not.toContain("BESOINS_HUMAIN");
  });
  it("une seule variable manquante : seule celle-ci est citée, jamais de valeur", () => {
    const secret = ["ed25519", "ABCDEFGHIJKLMNOPQRSTUV"].join(":");
    const m = checkTestnetEnv(loadConfig({ DARWIN_MODE: "testnet", NEAR_MASTER_PRIVATE_KEY: secret }))!;
    expect(m).toContain("NEAR_MASTER_ACCOUNT_ID");
    expect(m).not.toContain("NEAR_MASTER_PRIVATE_KEY,");
    expect(m).not.toContain("ABCDEFGH");
  });
  it("mock ou variables présentes : rien", () => {
    expect(checkTestnetEnv(loadConfig({}))).toBeUndefined();
    expect(checkTestnetEnv(loadConfig({ DARWIN_MODE: "testnet", NEAR_MASTER_ACCOUNT_ID: "m.testnet", NEAR_MASTER_PRIVATE_KEY: ["ed25519", "ABCDEFGHIJKLMNOPQRSTUV"].join(":") }))).toBeUndefined();
  });
});
