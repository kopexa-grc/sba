import type { AssessmentVersion } from "./types";

/** Deterministic JSON with sorted object keys. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/** The content a report is about; edit timestamps are left out so re-saving unchanged content keeps the value. */
function fingerprintPayload(v: AssessmentVersion) {
  return {
    id: v.id,
    assetId: v.assetId,
    version: `${v.major}.${v.minor}`,
    status: v.status,
    meta: v.meta,
    answers: v.answers,
    overrides: v.overrides,
    justifications: v.justifications,
    changeSummary: v.changeSummary,
    scheme: v.scheme,
    createdAt: v.createdAt,
    createdBy: v.createdBy,
    closedAt: v.closedAt,
    closedBy: v.closedBy,
  };
}

/**
 * SHA-256 over the content of one version (hex). Printed on every report page so
 * pages of different versions or documents cannot be mixed unnoticed; the app shows
 * the same value in the history, where it can be compared.
 */
export async function fingerprint(v: AssessmentVersion): Promise<string> {
  const bytes = new TextEncoder().encode(stableStringify(fingerprintPayload(v)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Short, readable form for page footers: first 16 hex digits in groups of four. */
export function shortFingerprint(hex: string): string {
  return (hex.slice(0, 16).toUpperCase().match(/.{4}/g) ?? []).join("-");
}

/** Full value in groups of eight, for the sign-off page and appendix. */
export function groupedFingerprint(hex: string): string {
  return (hex.toUpperCase().match(/.{8}/g) ?? []).join(" ");
}
