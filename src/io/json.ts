import { z } from "zod";
import type { AssessmentVersion, Asset, AuditEntry } from "../domain/types";
import { verifyIntegrity } from "../domain/versioning";

export const SCHEMA_VERSION = "1.0.0";
export const FILE_SUFFIX = ".sba.json";

const level = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const signoff = z.object({ at: z.string(), by: z.string(), comment: z.string().optional() });
const answer = z.object({
  applies: z.boolean().nullable(),
  level: level.nullable(),
  notes: z.string(),
  explanation: z.string(),
});
const scenarioAnswers = z.partialRecord(
  z.enum(["legal", "privacy", "safety", "operations", "reputation", "financial"]),
  answer,
);
const override = z
  .object({
    level,
    kind: z.enum(["inheritance", "cumulation", "distribution", "other"]),
    reason: z.string(),
  })
  .nullable();

const versionSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  major: z.number().int().nonnegative(),
  minor: z.number().int().nonnegative(),
  status: z.enum(["draft", "review", "approved", "archived"]),
  meta: z.object({
    name: z.string(),
    type: z.enum(["application", "infrastructure", "information-domain", "process", "room"]),
    owner: z.string(),
    orgUnit: z.string(),
    contact: z.string(),
    assessor: z.string(),
    description: z.string(),
    scope: z.string(),
    location: z.string().default(""),
    personalData: z.boolean().nullable(),
    specialCategoryData: z.boolean().nullable(),
  }),
  answers: z.object({ C: scenarioAnswers, I: scenarioAnswers, A: scenarioAnswers }),
  overrides: z.object({ C: override, I: override, A: override }),
  justifications: z.object({ C: z.string(), I: z.string(), A: z.string() }),
  changeSummary: z.string(),
  parentVersionId: z.string().nullable(),
  createdAt: z.string(),
  createdBy: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string(),
  submitted: signoff.nullable(),
  approved: signoff.nullable(),
  rejections: z.array(signoff),
  hash: z.string().nullable(),
  supersededBy: z.string().nullable(),
});

const auditSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  versionId: z.string(),
  versionLabel: z.string(),
  at: z.string(),
  actor: z.string(),
  action: z.enum([
    "create",
    "update",
    "submit",
    "reject",
    "approve",
    "branch",
    "supersede",
    "archive",
    "import",
    "delete-draft",
  ]),
  field: z.string().nullable(),
  oldValue: z.string().nullable(),
  newValue: z.string().nullable(),
  reason: z.string().nullable(),
});

const bundleSchema = z.object({
  schemaVersion: z.string(),
  app: z.string(),
  exportedAt: z.string(),
  exportedBy: z.string().optional(),
  assets: z.array(
    z.object({
      asset: z.object({ id: z.string(), createdAt: z.string(), latestVersionId: z.string() }),
      versions: z.array(versionSchema),
      audit: z.array(auditSchema),
    }),
  ),
});

export type Bundle = z.infer<typeof bundleSchema>;

export interface BundleRecord {
  asset: Asset;
  versions: AssessmentVersion[];
  audit: AuditEntry[];
}

export function buildBundle(records: BundleRecord[], exportedBy?: string): Bundle {
  return {
    schemaVersion: SCHEMA_VERSION,
    app: "kopexa-sba",
    exportedAt: new Date().toISOString(),
    ...(exportedBy ? { exportedBy } : {}),
    assets: records,
  };
}

export class BundleError extends Error {}

export interface ParsedBundle {
  records: BundleRecord[];
  /** Approved versions whose seal does not match their content. */
  tampered: { versionId: string; name: string }[];
}

function major(v: string): number {
  return Number.parseInt(v.split(".")[0] ?? "0", 10);
}

export async function parseBundle(text: string): Promise<ParsedBundle> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BundleError("Die Datei ist kein gültiges JSON.");
  }
  const result = bundleSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new BundleError(
      `Die Datei entspricht nicht dem SBA-Format (${first?.path.join(".") || "Wurzel"}: ${first?.message}).`,
    );
  }
  if (major(result.data.schemaVersion) > major(SCHEMA_VERSION)) {
    throw new BundleError(
      `Die Datei wurde mit einer neueren Schema-Version (${result.data.schemaVersion}) erstellt. Bitte aktualisieren Sie die App.`,
    );
  }
  const records = result.data.assets as BundleRecord[];
  const tampered: ParsedBundle["tampered"] = [];
  for (const r of records) {
    for (const v of r.versions) {
      if ((await verifyIntegrity(v)) === "tampered") tampered.push({ versionId: v.id, name: v.meta.name });
    }
  }
  return { records, tampered };
}
