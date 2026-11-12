// Tests of the pure functions of the attestation verifier (no network, no key).
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { expectedText, replayRtmr3 } from "./verify-attestation.mjs";

const sha = (alg, ...p) => { const h = createHash(alg); p.forEach((x) => h.update(x)); return h.digest(); };

describe("verify-attestation: pure functions", () => {
  it("signed text = model:SHA256(request):SHA256(response)", () => {
    const t = expectedText("m/x", Buffer.from("req"), Buffer.from("res"));
    expect(t).toBe(`m/x:${sha("sha256", "req").toString("hex")}:${sha("sha256", "res").toString("hex")}`);
    expect(expectedText("m/x", Buffer.from("req"), Buffer.from("res "))).not.toBe(t); // one extra byte changes the text
  });
  it("RTMR3 replay: only imr=3 events, SHA-384 extension, supplied digest verified", () => {
    const ev = { imr: 3, event_type: 134217729, event: "app-id", event_payload: "abcd" };
    const t = Buffer.alloc(4); t.writeUInt32LE(ev.event_type);
    const digest = sha("sha384", t, ":", Buffer.from(ev.event), ":", Buffer.from(ev.event_payload, "hex"));
    const expected = sha("sha384", Buffer.alloc(48), digest);
    const log = [{ imr: 0, event_type: 1, event: "other", event_payload: "00" }, { ...ev, digest: digest.toString("hex") }];
    expect(replayRtmr3(JSON.stringify(log)).equals(expected)).toBe(true); // log supplied as a JSON string
    expect(() => replayRtmr3([{ ...ev, digest: "00".repeat(48) }])).toThrow(/inconsistent/);
  });
});
