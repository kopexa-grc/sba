import { describe, expect, it } from "vitest";
import { CATALOG, SCENARIO_COUNT } from "./catalog";
import { diffVersions, goalLevelChanges } from "./diff";
import { goalResult, progress, scenarioLevel, validate } from "./scoring";
import type { AssessmentVersion, Goal, ScenarioAnswer } from "./types";
import { catalogFor, DEFAULT_SNAPSHOT, definitionsFor, schemeErrors } from "./scheme";
import { branchVersion, closeVersion, newVersion, nextNumber, versionLabel, WorkflowError } from "./versioning";

const no = (): ScenarioAnswer => ({ applies: false, level: null, notes: "", explanation: "" });
const yes = (level: 1 | 2 | 3, explanation = "weil"): ScenarioAnswer => ({ applies: true, level, notes: "", explanation });

function allNormal(v: AssessmentVersion): AssessmentVersion {
  for (const g of ["C", "I", "A"] as Goal[]) {
    for (const s of CATALOG[g].scenarios) v.answers[g][s.id] = no();
  }
  return v;
}

function complete(): AssessmentVersion {
  const v = allNormal(newVersion("asset-1", "alice"));
  v.meta.name = "CRM";
  v.meta.owner = "Vertrieb";
  v.meta.assessor = "alice";
  v.meta.scope = "Gesamter Vertrieb";
  return v;
}

describe("catalog", () => {
  it("mirrors the legacy sheet: 5 confidentiality and 6 integrity/availability scenarios", () => {
    expect(CATALOG.C.scenarios).toHaveLength(5);
    expect(CATALOG.I.scenarios).toHaveLength(6);
    expect(CATALOG.A.scenarios).toHaveLength(6);
    expect(SCENARIO_COUNT).toBe(17);
  });

  it("uses the gate rows referenced by the legacy helper table", () => {
    expect(CATALOG.C.scenarios.map((s) => s.gateRow)).toEqual([3, 9, 17, 23, 29]);
    expect(CATALOG.I.scenarios.map((s) => s.gateRow)).toEqual([39, 45, 51, 54, 60, 66]);
    expect(CATALOG.A.scenarios.map((s) => s.gateRow)).toEqual([76, 82, 88, 91, 97, 103]);
  });
});

describe("scoring", () => {
  it("treats a negative gate as normal and an open answer as unknown", () => {
    expect(scenarioLevel(no())).toBe(1);
    expect(scenarioLevel({ applies: true, level: null, notes: "", explanation: "" })).toBeNull();
    expect(scenarioLevel(undefined)).toBeNull();
    expect(scenarioLevel(yes(3))).toBe(3);
  });

  it("applies the maximum principle per goal", () => {
    const v = complete();
    v.answers.I.legal = yes(3);
    v.answers.I.financial = yes(2);
    const r = goalResult(v, "I");
    expect(r.computed).toBe(3);
    expect(r.drivers).toEqual(["legal"]);
    expect(r.complete).toBe(true);
    expect(goalResult(v, "C").computed).toBe(1);
  });

  it("reports provisional results while incomplete", () => {
    const v = newVersion("a", "x");
    v.answers.A.operations = yes(2);
    const r = goalResult(v, "A");
    expect(r.computed).toBe(2);
    expect(r.complete).toBe(false);
    expect(progress(v)).toEqual({ answered: 1, total: 17 });
  });

  it("lets an override replace the computed level, including downgrades", () => {
    const v = complete();
    v.answers.A.operations = yes(3);
    v.overrides.A = { level: 2, kind: "distribution", reason: "Redundanz" };
    expect(goalResult(v, "A").effective).toBe(2);
  });

  it("requires justifications for high levels and explanations for high scenarios", () => {
    const v = complete();
    expect(validate(v).filter((i) => i.severity === "error")).toEqual([]);
    v.answers.C.privacy = yes(2, "");
    const paths = validate(v)
      .filter((i) => i.severity === "error")
      .map((i) => i.path);
    expect(paths).toContain("C.privacy");
    expect(paths).toContain("justification.C");
  });

  it("requires a reason for overrides", () => {
    const v = complete();
    v.overrides.I = { level: 2, kind: "cumulation", reason: " " };
    v.justifications.I = "x";
    expect(validate(v).map((i) => i.path)).toContain("override.I");
  });
});

describe("versioning", () => {
  it("labels working copies as -dev", () => {
    const v = newVersion("a", "x");
    expect(versionLabel(v)).toBe("1.0-dev");
    expect(versionLabel({ ...v, status: "final" })).toBe("1.0");
  });

  it("computes the next free number", () => {
    const existing = [
      { major: 1, minor: 0 },
      { major: 1, minor: 1 },
      { major: 2, minor: 0 },
    ];
    expect(nextNumber(existing, { major: 1, minor: 0 }, "minor")).toEqual({ major: 1, minor: 2 });
    expect(nextNumber(existing, { major: 1, minor: 1 }, "major")).toEqual({ major: 3, minor: 0 });
  });

  it("closes a draft and makes it final", () => {
    const closed = closeVersion(complete(), "alice");
    expect(closed.status).toBe("final");
    expect(closed.closedBy).toBe("alice");
    expect(versionLabel(closed)).toBe("1.0");
    expect(() => closeVersion(closed, "alice")).toThrow(WorkflowError);
  });

  it("branches a new draft from a closed version with the current scheme", () => {
    const closed = closeVersion(complete(), "alice");
    const scheme = { ...DEFAULT_SNAPSHOT, revision: 2, financialHigh: 50_000, financialVeryHigh: 500_000 };
    const next = branchVersion(closed, [closed], "minor", "bob", "Rezertifizierung", scheme);
    expect(next.status).toBe("draft");
    expect(versionLabel(next)).toBe("1.1-dev");
    expect(next.parentVersionId).toBe(closed.id);
    expect(next.closedAt).toBeNull();
    expect(next.scheme.revision).toBe(2);
    expect(next.answers).toEqual(closed.answers);
    expect(next.answers).not.toBe(closed.answers);
  });
});

describe("scheme", () => {
  it("fills thresholds into the question texts", () => {
    const scheme = { ...DEFAULT_SNAPSHOT, financialHigh: 50_000, financialVeryHigh: 500_000, availabilityHighHours: 8, availabilityVeryHighHours: 2 };
    const cat = catalogFor(scheme);
    const fin = cat.I.scenarios.find((x) => x.id === "financial")!;
    expect(fin.options[1]!.text).toContain("50.000");
    expect(fin.options[2]!.text).toContain("500.000");
    const ops = cat.A.scenarios.find((x) => x.id === "operations")!;
    expect(ops.options[1]!.text).toContain("zwischen 2 Stunden und 8 Stunden");
    expect(ops.options[2]!.text).toContain("bis zu einer Dauer von 2 Stunden");
    // The shared catalog stays untouched.
    expect(CATALOG.I.scenarios.find((x) => x.id === "financial")!.options[1]!.text).toContain("1.000.000");
    const defs = definitionsFor(scheme).find((d) => d.scenario === "financial")!;
    expect(defs.high.C).toContain("50.000");
  });

  it("rejects implausible thresholds", () => {
    expect(schemeErrors(DEFAULT_SNAPSHOT)).toEqual([]);
    expect(schemeErrors({ ...DEFAULT_SNAPSHOT, financialVeryHigh: 1 })).toHaveLength(1);
    expect(schemeErrors({ ...DEFAULT_SNAPSHOT, availabilityHighHours: 1 })).toHaveLength(1);
  });
});

describe("diff", () => {
  it("classifies escalations, relaxations, reasoning and context changes", () => {
    const a = complete();
    a.answers.A.financial = yes(2);
    const b = structuredClone(a);
    b.answers.C.legal = yes(3, "Art. 9 DSGVO");
    b.answers.A.financial = no();
    b.meta.owner = "IT";
    b.justifications.C = "Gesundheitsdaten";

    const byPath = Object.fromEntries(diffVersions(a, b).map((c) => [c.path, c]));
    expect(byPath["C.legal"]).toMatchObject({ kind: "escalated", oldValue: "Normal", newValue: "Sehr hoch", isRating: true });
    expect(byPath["A.financial"]).toMatchObject({ kind: "relaxed", oldValue: "Hoch", newValue: "Normal" });
    expect(byPath["meta.owner"]).toMatchObject({ kind: "context", oldValue: "Vertrieb", newValue: "IT" });
    expect(byPath["justification.C"]).toMatchObject({ kind: "reasoning" });

    const goals = goalLevelChanges(a, b);
    expect(goals.find((g) => g.goal === "C")).toMatchObject({ from: 1, to: 3, kind: "escalated" });
    expect(goals.find((g) => g.goal === "A")).toMatchObject({ from: 2, to: 1, kind: "relaxed" });
    expect(goals.find((g) => g.goal === "I")?.kind).toBeNull();
  });

  it("reports nothing for identical versions", () => {
    const a = complete();
    expect(diffVersions(a, structuredClone(a))).toEqual([]);
  });
});
