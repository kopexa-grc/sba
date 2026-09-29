import { z } from "zod";
import { DEFAULT_SNAPSHOT, type Settings } from "../domain/scheme";
import type { AssessmentVersion, Asset, AuditAction, AuditEntry } from "../domain/types";

/**
 * One file format for everything (`.sba`, gzip-compressed JSON; plain `.sba.json` is read as well):
 * - kind "settings":    organization, rating scheme and measures – to share with colleagues
 * - kind "assessments": one or more analyses with all versions and the change log
 * - kind "backup":      settings plus all analyses
 * Files of schema 1.x (before the approval workflow was removed) are migrated on import.
 */
export const SCHEMA_VERSION = "2.1.0";
export const FILE_SUFFIX = ".sba";
/** File picker filter: compressed files and plain JSON from older exports. */
export const FILE_ACCEPT = ".sba,.json,application/json";

export type BundleKind = "settings" | "assessments" | "backup";

const level = z.union([z.literal(1), z.literal(2), z.literal(3)]);
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

const schemeFields = {
  name: z.string(),
  revision: z.number().int().positive(),
  financialHigh: z.number().positive(),
  financialVeryHigh: z.number().positive(),
  availabilityHighHours: z.number().positive(),
  availabilityVeryHighHours: z.number().positive(),
};
const schemeSnapshot = z.object(schemeFields);

const measureList = z.array(z.string());
const measuresSchema = z.object({
  C: z.object({ 2: measureList, 3: measureList }),
  I: z.object({ 2: measureList, 3: measureList }),
  A: z.object({ 2: measureList, 3: measureList }),
});

const settingsSchema = z.object({
  organization: z.object({ name: z.string(), logo: z.string().nullable() }),
  // 2.1: optional "prepared by" (consultancy); older files get an empty one.
  preparedBy: z.object({ name: z.string(), logo: z.string().nullable() }).default({ name: "", logo: null }),
  scheme: z.object({ ...schemeFields, updatedAt: z.string() }),
  measures: measuresSchema,
});

const meta = z.object({
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
});

const versionBase = {
  id: z.string(),
  assetId: z.string(),
  major: z.number().int().nonnegative(),
  minor: z.number().int().nonnegative(),
  meta,
  answers: z.object({ C: scenarioAnswers, I: scenarioAnswers, A: scenarioAnswers }),
  overrides: z.object({ C: override, I: override, A: override }),
  justifications: z.object({ C: z.string(), I: z.string(), A: z.string() }),
  changeSummary: z.string(),
  parentVersionId: z.string().nullable(),
  createdAt: z.string(),
  createdBy: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string(),
};

const versionV2 = z.object({
  ...versionBase,
  status: z.enum(["draft", "final"]),
  closedAt: z.string().nullable(),
  closedBy: z.string().nullable(),
  scheme: schemeSnapshot,
});

/** Schema 1.x: review workflow with sign-offs and a seal. */
const signoff = z.object({ at: z.string(), by: z.string(), comment: z.string().optional() });
const versionV1 = z.object({
  ...versionBase,
  status: z.enum(["draft", "review", "approved", "archived"]),
  submitted: signoff.nullable().optional(),
  approved: signoff.nullable().optional(),
});

const auditBase = {
  id: z.string(),
  assetId: z.string(),
  versionId: z.string(),
  versionLabel: z.string(),
  at: z.string(),
  actor: z.string(),
  field: z.string().nullable(),
  oldValue: z.string().nullable(),
  newValue: z.string().nullable(),
  reason: z.string().nullable(),
};
const auditV2 = z.object({ ...auditBase, action: z.enum(["create", "update", "close", "branch", "import", "delete-draft"]) });
const auditV1 = z.object({ ...auditBase, action: z.string() });

const assetSchema = z.object({ id: z.string(), createdAt: z.string(), latestVersionId: z.string() });

const bundleV2 = z.object({
  schemaVersion: z.string(),
  app: z.literal("kopexa-sba"),
  kind: z.enum(["settings", "assessments", "backup"]),
  exportedAt: z.string(),
  exportedBy: z.string().optional(),
  appVersion: z.string().optional(),
  settings: settingsSchema.optional(),
  assets: z.array(z.object({ asset: assetSchema, versions: z.array(versionV2), audit: z.array(auditV2) })).optional(),
});

const bundleV1 = z.object({
  schemaVersion: z.string(),
  app: z.string(),
  exportedAt: z.string(),
  assets: z.array(z.object({ asset: assetSchema, versions: z.array(versionV1), audit: z.array(auditV1) })),
});

export interface BundleRecord {
  asset: Asset;
  versions: AssessmentVersion[];
  audit: AuditEntry[];
}

export interface Bundle {
  schemaVersion: string;
  app: "kopexa-sba";
  kind: BundleKind;
  exportedAt: string;
  exportedBy?: string;
  /** App release that wrote the file (informational; compatibility is decided by schemaVersion). */
  appVersion?: string;
  settings?: Settings;
  assets?: BundleRecord[];
}

export function buildBundle(content: { settings?: Settings; assets?: BundleRecord[] }, exportedBy?: string): Bundle {
  const kind: BundleKind = content.settings && content.assets ? "backup" : content.settings ? "settings" : "assessments";
  return {
    schemaVersion: SCHEMA_VERSION,
    app: "kopexa-sba",
    kind,
    exportedAt: new Date().toISOString(),
    appVersion: __APP_VERSION__,
    ...(exportedBy ? { exportedBy } : {}),
    ...content,
  };
}

export class BundleError extends Error {}

export interface ParsedBundle {
  kind: BundleKind;
  settings: Settings | null;
  records: BundleRecord[];
  /** Set when the file was written by an older app version and migrated. */
  migratedFrom: string | null;
}

function major(v: string): number {
  return Number.parseInt(v.split(".")[0] ?? "0", 10);
}

const V1_ACTION: Record<string, AuditAction> = {
  create: "create",
  update: "update",
  branch: "branch",
  import: "import",
  "delete-draft": "delete-draft",
  approve: "close",
};

function migrateV1(data: z.infer<typeof bundleV1>): BundleRecord[] {
  return data.assets.map((r) => ({
    asset: r.asset,
    versions: r.versions.map((v) => {
      const { submitted: _s, approved, status, ...rest } = v;
      const final = status === "approved" || status === "archived";
      return {
        ...rest,
        status: final ? "final" : "draft",
        closedAt: final ? (approved?.at ?? v.updatedAt) : null,
        closedBy: final ? (approved?.by ?? v.updatedBy) : null,
        scheme: DEFAULT_SNAPSHOT,
      } satisfies AssessmentVersion;
    }),
    // Review steps no longer exist; their entries are kept as plain updates so the history stays complete.
    audit: r.audit.map((a) => ({
      ...a,
      action: V1_ACTION[a.action] ?? "update",
      field: a.field ?? (V1_ACTION[a.action] ? null : `Prüfschritt (${a.action})`),
    })),
  }));
}

export async function parseBundle(text: string): Promise<ParsedBundle> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BundleError("Die Datei ist kein gültiges JSON.");
  }
  const version = typeof raw === "object" && raw && "schemaVersion" in raw ? String((raw as { schemaVersion: unknown }).schemaVersion) : "";
  if (!version) throw new BundleError("Die Datei ist keine Datei der Schutzbedarfsanalyse.");
  if (major(version) > major(SCHEMA_VERSION)) {
    throw new BundleError(`Die Datei stammt aus einer neueren App-Version (Format ${version}). Bitte laden Sie die Seite neu.`);
  }

  if (major(version) < 2) {
    const r = bundleV1.safeParse(raw);
    if (!r.success) throw formatError(r.error);
    return { kind: "assessments", settings: null, records: migrateV1(r.data), migratedFrom: version };
  }

  const r = bundleV2.safeParse(raw);
  if (!r.success) throw formatError(r.error);
  return {
    kind: r.data.kind,
    settings: (r.data.settings as Settings | undefined) ?? null,
    records: (r.data.assets as BundleRecord[] | undefined) ?? [],
    migratedFrom: null,
  };
}

async function pipe(data: Uint8Array, transform: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Serializes a bundle as gzip-compressed JSON. Versions are complete snapshots; gzip removes their redundancy. */
export async function encodeBundle(bundle: Bundle): Promise<Uint8Array> {
  return pipe(new TextEncoder().encode(JSON.stringify(bundle)), new CompressionStream("gzip"));
}

/** Reads a compressed `.sba` file or plain JSON and parses it. */
export async function readBundleFile(data: ArrayBuffer | Uint8Array): Promise<ParsedBundle> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const gzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  let text: string;
  try {
    text = new TextDecoder().decode(gzip ? await pipe(bytes, new DecompressionStream("gzip")) : bytes);
  } catch {
    throw new BundleError("Die Datei ist beschädigt und lässt sich nicht entpacken.");
  }
  return parseBundle(text);
}

function formatError(error: z.ZodError): BundleError {
  const first = error.issues[0];
  return new BundleError(`Die Datei ist beschädigt oder unvollständig (${first?.path.join(".") || "Wurzel"}: ${first?.message}).`);
}
