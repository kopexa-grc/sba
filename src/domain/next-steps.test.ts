import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { nextSteps } from "./next-steps";
import { applySample } from "./sample";
import type { Goal } from "./types";
import { newVersion } from "./versioning";

describe("next steps", () => {
  it("suggests risk analysis, BIA, dependencies and DPIA for a high-protection application", () => {
    const v = newVersion("a", "x");
    applySample(v); // C Hoch, A Sehr hoch, personal data, application
    const ids = nextSteps(v).map((s) => s.id);
    expect(ids).toEqual(["risk-analysis", "controls", "bia", "dependencies", "dpia", "review"]);
    expect(nextSteps(v).find((s) => s.id === "dependencies")?.action).toBe("capture-assets");
  });

  it("keeps it short for a normal-protection room", () => {
    const v = newVersion("a", "x", { type: "room" });
    for (const g of ["C", "I", "A"] as Goal[]) {
      for (const s of CATALOG[g].scenarios) v.answers[g][s.id] = { applies: false, level: null, notes: "", explanation: "" };
    }
    expect(nextSteps(v).map((s) => s.id)).toEqual(["controls", "review"]);
  });

  it("links only to kopexa.com knowledge pages", () => {
    const v = newVersion("a", "x");
    applySample(v);
    for (const s of nextSteps(v)) if (s.link) expect(s.link.href).toMatch(/^https:\/\/kopexa\.com\/de\/(glossary|catalog)\//);
  });
});
