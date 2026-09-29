/** Protection goals ("Grundwerte"). */
export type Goal = "C" | "I" | "A";

export const GOALS: Goal[] = ["C", "I", "A"];

export const GOAL_LABEL: Record<Goal, string> = {
  C: "Vertraulichkeit",
  I: "Integrität",
  A: "Verfügbarkeit",
};

export const GOAL_SHORT: Record<Goal, string> = { C: "V", I: "I", A: "A" };

/**
 * Protection level. 0 = not relevant (scenario does not apply to the goal),
 * 1 = normal, 2 = high, 3 = very high.
 */
export type Level = 0 | 1 | 2 | 3;

export const LEVEL_LABEL: Record<Level, string> = {
  0: "Nicht relevant",
  1: "Normal",
  2: "Hoch",
  3: "Sehr hoch",
};

export type ScenarioId =
  | "legal"
  | "privacy"
  | "safety"
  | "operations"
  | "reputation"
  | "financial";

export type AssetType =
  | "application"
  | "infrastructure"
  | "information-domain"
  | "process"
  | "room";

export const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  application: "Anwendung",
  infrastructure: "Infrastruktur",
  "information-domain": "Informationsverbund",
  process: "Prozess",
  room: "Physischer Raum",
};

export type VersionStatus = "draft" | "review" | "approved" | "archived";

export const STATUS_LABEL: Record<VersionStatus, string> = {
  draft: "Entwurf",
  review: "In Prüfung",
  approved: "Freigegeben",
  archived: "Archiviert",
};

/** Answer to one damage scenario of one goal. */
export interface ScenarioAnswer {
  /** Gate question ("Erfordern Gesetze ...?"). null = not answered yet. */
  applies: boolean | null;
  /** Selected impact level when the gate question is answered with yes. */
  level: 1 | 2 | 3 | null;
  /** "weitere Ausführungen" column of the legacy sheet. */
  notes: string;
  /** "Erläuterung Schutzbedarf" column of the legacy sheet. */
  explanation: string;
}

export type OverrideKind = "inheritance" | "cumulation" | "distribution" | "other";

export const OVERRIDE_KIND_LABEL: Record<OverrideKind, string> = {
  inheritance: "Schutzbedarfsvererbung (Maximumprinzip über Abhängigkeiten)",
  cumulation: "Kumulationseffekt",
  distribution: "Verteilungseffekt",
  other: "Sonstige Begründung",
};

/** Manual override of the computed protection level of one goal. */
export interface GoalOverride {
  level: 1 | 2 | 3;
  kind: OverrideKind;
  reason: string;
}

export interface AssetMeta {
  name: string;
  type: AssetType;
  owner: string;
  orgUnit: string;
  contact: string;
  assessor: string;
  description: string;
  scope: string;
  location: string;
  personalData: boolean | null;
  specialCategoryData: boolean | null;
}

export type Answers = Record<Goal, Partial<Record<ScenarioId, ScenarioAnswer>>>;

export interface Signoff {
  at: string;
  by: string;
  comment?: string;
}

export interface AssessmentVersion {
  id: string;
  assetId: string;
  major: number;
  minor: number;
  status: VersionStatus;
  meta: AssetMeta;
  answers: Answers;
  overrides: Record<Goal, GoalOverride | null>;
  /** Mandatory justification per goal when the effective level is high or very high. */
  justifications: Record<Goal, string>;
  /** Short description of what changed in this version (history table). */
  changeSummary: string;
  parentVersionId: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  /** Submitted for review ("fachlich freigegeben"). */
  submitted: Signoff | null;
  /** Final approval ("freigegeben"). */
  approved: Signoff | null;
  /** Rejections during review, newest last. */
  rejections: Signoff[];
  /** SHA-256 over the canonical payload, set when the version is approved. */
  hash: string | null;
  /** Set when a later version is approved and supersedes this one. */
  supersededBy: string | null;
}

export interface Asset {
  id: string;
  createdAt: string;
  /** Denormalized for list views; always mirrors the latest version. */
  latestVersionId: string;
}

export type AuditAction =
  | "create"
  | "update"
  | "submit"
  | "reject"
  | "approve"
  | "branch"
  | "supersede"
  | "archive"
  | "import"
  | "delete-draft";

export interface AuditEntry {
  id: string;
  assetId: string;
  versionId: string;
  /** Version label at the time of the entry, e.g. "1.1-dev". */
  versionLabel: string;
  at: string;
  actor: string;
  action: AuditAction;
  /** Dot path of the changed field, e.g. "C.legal" or "meta.owner". */
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
}
