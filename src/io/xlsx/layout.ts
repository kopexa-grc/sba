import type { ScenarioDef } from "../../domain/catalog";
import type { Goal, VersionStatus } from "../../domain/types";

/**
 * Coordinates and labels shared by the XLSX export and import. Cell positions
 * follow the legacy workbook FS_Schutzbedarfsanalyse_neu.xlsx.
 */

export const SHEET = {
  cover: "Deckblatt",
  assessment: "Anwendung",
  audit: "Audit-Trail",
  definitions: "Definitionen",
  helper: "Hilfstabelle",
} as const;

export const COVER = {
  name: "D5",
  version: "D7",
  status: "D9",
  editedAt: "D11",
  editedBy: "H11",
  submittedAt: "D12",
  submittedBy: "H12",
  approvedAt: "D13",
  approvedBy: "H13",
  orgUnit: "D15",
  contact: "D16",
  personalData: "D18",
  specialCategoryData: "I18",
  /** Summary rows 21-23 (C: label, D: level, F: justification). */
  summaryRow: { C: 21, I: 22, A: 23 } as Record<Goal, number>,
  historyHeaderRow: 26,
  historyFirstRow: 27,
  /** The legacy sheet reserves ten history rows. */
  historyMinRows: 10,
} as const;

/** Heading of the additional master data block below the history table. */
export const EXTRA_BLOCK_TITLE = "Weitere Stammdaten";

export const EXTRA_LABEL = {
  type: "Asset-Typ",
  owner: "Asset-Owner",
  assessor: "Ersteller:in der Analyse",
  description: "Beschreibung / Einsatzzweck",
  scope: "Geltungsbereich",
  location: "Standort",
  assetId: "Asset-ID",
  versionId: "Versions-ID",
  approval: "Freigabe",
  hash: "Integritäts-Hash (SHA-256)",
} as const;

/** Row (per goal) below each questionnaire block that carries a manual override. */
export const OVERRIDE_ROW: Record<Goal, number> = { C: 35, I: 72, A: 109 };
export const OVERRIDE_LABEL = "Manuelle Übersteuerung";

export const PLACEHOLDERS = [
  "hier das asset eintragen",
  "versionsangabe",
  "<bitte auswählen>",
  "bitte auswählen",
  "tt.mm.jjjj",
];

export const LEGACY_STATUS: Record<VersionStatus, string> = {
  draft: "in Bearbeitung",
  review: "fachlich freigegeben",
  approved: "freigegeben",
  archived: "freigegeben",
};

/** Kopexa navy (primary-950, oklch(26.35% 0.054 251.42)) and traffic light colours. */
export const COLOR = {
  navy: "FF10263E",
  navyLight: "FFEEF3FB",
  border: "FFD5DCE6",
  muted: "FF5B6778",
  normal: "FF10B981",
  high: "FFF59E0B",
  veryHigh: "FFEF4444",
  check: "FFE5E7EB",
  white: "FFFFFFFF",
} as const;

/** Last row of a scenario block. */
export function blockEnd(def: ScenarioDef): number {
  return def.kind === "binary" ? def.followUpRow : Math.max(...def.options.map((o) => o.row));
}
