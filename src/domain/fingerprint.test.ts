import { describe, expect, it } from "vitest";
import { fingerprint, groupedFingerprint, shortFingerprint, stableStringify } from "./fingerprint";
import { applySample } from "./sample";
import { closeVersion, newVersion } from "./versioning";

describe("fingerprint", () => {
  it("is stable for the same content and ignores edit timestamps", async () => {
    const v = newVersion("a", "x");
    applySample(v);
    const a = await fingerprint(v);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await fingerprint({ ...structuredClone(v), updatedAt: "2030-01-01T00:00:00Z", updatedBy: "y" })).toBe(a);
  });

  it("changes with any assessed content and with closing", async () => {
    const v = newVersion("a", "x");
    applySample(v);
    const base = await fingerprint(v);
    const changed = structuredClone(v);
    changed.justifications.C += ".";
    expect(await fingerprint(changed)).not.toBe(base);
    expect(await fingerprint(closeVersion(v, "x"))).not.toBe(base);
  });

  it("formats short and grouped forms", () => {
    const hex = "3f9a1c2e8b77d0a4".padEnd(64, "0");
    expect(shortFingerprint(hex)).toBe("3F9A-1C2E-8B77-D0A4");
    expect(groupedFingerprint(hex).split(" ")).toHaveLength(8);
  });

  it("stringifies deterministically regardless of key order", () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: [3, { f: 1, e: 0 }] } })).toBe(stableStringify({ a: { c: [3, { e: 0, f: 1 }], d: 2 }, b: 1 }));
  });
});
