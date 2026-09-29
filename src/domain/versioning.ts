import type { AssessmentVersion, AssetMeta, Goal, ScenarioAnswer, Signoff } from "./types";

export function uid(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function versionNumber(v: Pick<AssessmentVersion, "major" | "minor">): string {
  return `${v.major}.${v.minor}`;
}

/** "1.1-dev" while the version is still editable or under review, "1.1" once approved. */
export function versionLabel(v: Pick<AssessmentVersion, "major" | "minor" | "status">): string {
  const n = versionNumber(v);
  return v.status === "draft" || v.status === "review" ? `${n}-dev` : n;
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

export function newVersion(assetId: string, actor: string, meta: Partial<AssetMeta> = {}): AssessmentVersion {
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
    submitted: null,
    approved: null,
    rejections: [],
    hash: null,
    supersededBy: null,
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

/** Opens a new working copy based on an approved (or archived) version. */
export function branchVersion(
  from: AssessmentVersion,
  existing: AssessmentVersion[],
  kind: "minor" | "major",
  actor: string,
  changeSummary: string,
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
    submitted: null,
    approved: null,
    rejections: [],
    hash: null,
    supersededBy: null,
  };
}

/** Deterministic JSON with sorted object keys, the basis for the integrity hash. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/**
 * Content covered by the integrity hash. Lifecycle fields that legitimately
 * change after approval (status, supersededBy, updatedAt/By) are excluded.
 */
export function hashPayload(v: AssessmentVersion) {
  return {
    id: v.id,
    assetId: v.assetId,
    major: v.major,
    minor: v.minor,
    meta: v.meta,
    answers: v.answers,
    overrides: v.overrides,
    justifications: v.justifications,
    changeSummary: v.changeSummary,
    parentVersionId: v.parentVersionId,
    createdAt: v.createdAt,
    createdBy: v.createdBy,
    submitted: v.submitted,
    approved: v.approved,
    rejections: v.rejections,
  };
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function computeHash(v: AssessmentVersion): Promise<string> {
  return sha256Hex(stableStringify(hashPayload(v)));
}

export type IntegrityState = "unsealed" | "valid" | "tampered";

export async function verifyIntegrity(v: AssessmentVersion): Promise<IntegrityState> {
  if (!v.hash) return "unsealed";
  return (await computeHash(v)) === v.hash ? "valid" : "tampered";
}

export function isLocked(v: Pick<AssessmentVersion, "status">): boolean {
  return v.status !== "draft";
}

// Workflow transitions. Each returns the updated version; persistence and audit
// logging happen in the repository layer.

export class WorkflowError extends Error {}

export function submitForReview(v: AssessmentVersion, actor: string, comment?: string): AssessmentVersion {
  if (v.status !== "draft") throw new WorkflowError("Nur Entwürfe können zur Prüfung eingereicht werden.");
  const at = nowIso();
  const submitted: Signoff = { at, by: actor, ...(comment ? { comment } : {}) };
  return { ...v, status: "review", submitted, updatedAt: at, updatedBy: actor };
}

export function rejectReview(v: AssessmentVersion, actor: string, comment: string): AssessmentVersion {
  if (v.status !== "review") throw new WorkflowError("Nur Versionen in Prüfung können zurückgewiesen werden.");
  if (!comment.trim()) throw new WorkflowError("Eine Zurückweisung erfordert einen Kommentar.");
  const at = nowIso();
  return {
    ...v,
    status: "draft",
    submitted: null,
    rejections: [...v.rejections, { at, by: actor, comment }],
    updatedAt: at,
    updatedBy: actor,
  };
}

export async function approve(v: AssessmentVersion, actor: string, comment?: string): Promise<AssessmentVersion> {
  if (v.status !== "review") throw new WorkflowError("Nur Versionen in Prüfung können freigegeben werden.");
  const at = nowIso();
  const approved: AssessmentVersion = {
    ...v,
    status: "approved",
    approved: { at, by: actor, ...(comment ? { comment } : {}) },
    updatedAt: at,
    updatedBy: actor,
  };
  return { ...approved, hash: await computeHash(approved) };
}

export function supersede(v: AssessmentVersion, byVersionId: string, actor: string): AssessmentVersion {
  return { ...v, status: "archived", supersededBy: byVersionId, updatedAt: nowIso(), updatedBy: actor };
}

export function goalsOf<T>(fn: (g: Goal) => T): Record<Goal, T> {
  return { C: fn("C"), I: fn("I"), A: fn("A") };
}
