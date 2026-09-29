import { DEFAULT_SNAPSHOT, type SchemeSnapshot } from "./scheme";
import type { AssessmentVersion, AssetMeta, Goal, ScenarioAnswer } from "./types";

export function uid(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function versionNumber(v: Pick<AssessmentVersion, "major" | "minor">): string {
  return `${v.major}.${v.minor}`;
}

/** "1.1-dev" while the version is being edited, "1.1" once closed. */
export function versionLabel(v: Pick<AssessmentVersion, "major" | "minor" | "status">): string {
  const n = versionNumber(v);
  return v.status === "draft" ? `${n}-dev` : n;
}

export function compareVersions(a: Pick<AssessmentVersion, "major" | "minor">, b: Pick<AssessmentVersion, "major" | "minor">) {
  return a.major - b.major || a.minor - b.minor;
}

export function emptyMeta(): AssetMeta {
  return {
    name: "",
    type: "application",
    owner: "",
    orgUnit: "",
    contact: "",
    assessor: "",
    description: "",
    scope: "",
    location: "",
    personalData: null,
    specialCategoryData: null,
  };
}

export function emptyAnswer(): ScenarioAnswer {
  return { applies: null, level: null, notes: "", explanation: "" };
}

export function newVersion(
  assetId: string,
  actor: string,
  meta: Partial<AssetMeta> = {},
  scheme: SchemeSnapshot = DEFAULT_SNAPSHOT,
): AssessmentVersion {
  const at = nowIso();
  return {
    id: uid(),
    assetId,
    major: 1,
    minor: 0,
    status: "draft",
    meta: { ...emptyMeta(), ...meta },
    answers: { C: {}, I: {}, A: {} },
    overrides: { C: null, I: null, A: null },
    justifications: { C: "", I: "", A: "" },
    changeSummary: "Ersterstellung",
    parentVersionId: null,
    createdAt: at,
    createdBy: actor,
    updatedAt: at,
    updatedBy: actor,
    closedAt: null,
    closedBy: null,
    scheme,
  };
}

/** Next free version number for a branch of the given kind. */
export function nextNumber(
  existing: Pick<AssessmentVersion, "major" | "minor">[],
  from: Pick<AssessmentVersion, "major" | "minor">,
  kind: "minor" | "major",
): { major: number; minor: number } {
  if (kind === "major") {
    const maxMajor = Math.max(from.major, ...existing.map((v) => v.major));
    return { major: maxMajor + 1, minor: 0 };
  }
  const sameMajor = existing.filter((v) => v.major === from.major).map((v) => v.minor);
  return { major: from.major, minor: Math.max(from.minor, ...sameMajor) + 1 };
}

/** Opens a new working copy based on a closed version, assessed with the current scheme. */
export function branchVersion(
  from: AssessmentVersion,
  existing: AssessmentVersion[],
  kind: "minor" | "major",
  actor: string,
  changeSummary: string,
  scheme: SchemeSnapshot = from.scheme,
): AssessmentVersion {
  const at = nowIso();
  const copy = structuredClone(from);
  return {
    ...copy,
    id: uid(),
    ...nextNumber(existing, from, kind),
    status: "draft",
    changeSummary,
    parentVersionId: from.id,
    createdAt: at,
    createdBy: actor,
    updatedAt: at,
    updatedBy: actor,
    closedAt: null,
    closedBy: null,
    scheme,
  };
}

export function isLocked(v: Pick<AssessmentVersion, "status">): boolean {
  return v.status !== "draft";
}

export class WorkflowError extends Error {}

/** Closes a draft; the author declares it complete, it becomes read-only. */
export function closeVersion(v: AssessmentVersion, actor: string): AssessmentVersion {
  if (v.status !== "draft") throw new WorkflowError("Die Version ist bereits abgeschlossen.");
  const at = nowIso();
  return { ...v, status: "final", closedAt: at, closedBy: actor, updatedAt: at, updatedBy: actor };
}

export function goalsOf<T>(fn: (g: Goal) => T): Record<Goal, T> {
  return { C: fn("C"), I: fn("I"), A: fn("A") };
}
