import ExcelJS from "exceljs";
import { CATALOG, type ScenarioDef } from "../../domain/catalog";
import {
  ASSET_TYPE_LABEL,
  GOALS,
  GOAL_LABEL,
  LEVEL_LABEL,
  OVERRIDE_KIND_LABEL,
  type Answers,
  type AssetMeta,
  type AssetType,
  type Goal,
  type GoalOverride,
  type OverrideKind,
  type ScenarioAnswer,
  type ScenarioId,
} from "../../domain/types";
import type { YesNo } from "./formulas";
import { COVER, EXTRA_BLOCK_TITLE, EXTRA_LABEL, OVERRIDE_LABEL, PLACEHOLDERS, SHEET } from "./layout";

export type ImportSeverity = "conflict" | "warning" | "info";

export interface ImportIssue {
  severity: ImportSeverity;
  goal?: Goal;
  scenario?: ScenarioId;
  message: string;
}

export type DetectionConfidence = "exact" | "shifted" | "missing";

export interface ScenarioDetection {
  goal: Goal;
  scenario: ScenarioId;
  /** Detected gate row in sheet "Anwendung", null if the scenario was not found. */
  row: number | null;
  confidence: DetectionConfidence;
  /** Raw Ja/Nein values: gate and option rows (binary: the follow-up row). */
  raw: { gate: string | null; options: (string | null)[] };
}

/** Plain, serializable copy of the relevant columns of sheet "Anwendung". */
export interface SheetRow {
  B: string | null;
  D: string | null;
  E: string | null;
  F: string | null;
  H: string | null;
}
export type SheetSnapshot = Record<number, SheetRow>;

export interface CandidateRow {
  row: number;
  text: string;
  value: string | null;
}

export interface LegacyImport {
  meta: Partial<AssetMeta>;
  versionLabel?: string;
  statusText?: string;
  answers: Answers;
  justifications: Record<Goal, string>;
  overrides: Record<Goal, GoalOverride | null>;
  rows: ScenarioDetection[];
  issues: ImportIssue[];
  /** All rows of sheet "Anwendung" with text in column D, for manual field mapping. */
  candidateRows: CandidateRow[];
  snapshot: SheetSnapshot;
}

export class XlsxImportError extends Error {}

// ---------------------------------------------------------------------------
// Cell helpers

type CellLike = { value: ExcelJS.CellValue };

function cellText(cell: CellLike | undefined): string | null {
  const v = cell?.value;
  if (v === null || v === undefined) return null;
  let out: string;
  if (typeof v === "string") out = v;
  else if (typeof v === "number" || typeof v === "boolean") out = String(v);
  else if (v instanceof Date) out = v.toISOString();
  else if (typeof v === "object" && "richText" in v) out = v.richText.map((r) => r.text).join("");
  else if (typeof v === "object" && "formula" in v) {
    const r = (v as ExcelJS.CellFormulaValue).result;
    if (r === undefined || r === null || typeof r === "object") return null;
    out = String(r);
  } else if (typeof v === "object" && "text" in v) out = String((v as { text: unknown }).text);
  else return null;
  out = out.replace(/ /g, " ").trim();
  return out === "" ? null : out;
}

function isPlaceholder(text: string | null): boolean {
  return text === null || PLACEHOLDERS.includes(text.toLowerCase());
}

function clean(text: string | null): string | null {
  return isPlaceholder(text) ? null : text;
}

export function parseYesNo(text: string | null): YesNo {
  if (!text) return null;
  const t = text.trim().toLowerCase();
  if (t === "ja" || t === "yes" || t === "x") return "Ja";
  if (t === "nein" || t === "no") return "Nein";
  return null;
}

function parseBool(text: string | null): boolean | null {
  const yn = parseYesNo(clean(text));
  return yn === null ? null : yn === "Ja";
}

function findSheet(wb: ExcelJS.Workbook, name: string): ExcelJS.Worksheet | undefined {
  const wanted = name.trim().toLowerCase();
  return wb.worksheets.find((ws) => ws.name.trim().toLowerCase() === wanted);
}

// ---------------------------------------------------------------------------
// Fuzzy text matching

export function normalize(text: string | null): string {
  return (text ?? "")
    .toLowerCase()
    .replace(/-\s*/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Dice coefficient over word sets, 0..1. */
export function similarity(a: string | null, b: string | null): number {
  const wa = new Set(normalize(a).split(" ").filter(Boolean));
  const wb = new Set(normalize(b).split(" ").filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return 0;
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  return (2 * common) / (wa.size + wb.size);
}

function matchScore(snapshot: SheetSnapshot, def: ScenarioDef, row: number): number {
  const r = snapshot[row];
  if (!r) return 0;
  return similarity(r.D, def.gate) + similarity(r.B, def.title);
}

// ---------------------------------------------------------------------------
// Scenario reading

function optionOffsets(def: ScenarioDef): number[] {
  return def.kind === "binary" ? [def.followUpRow - def.gateRow] : def.options.map((o) => o.row - def.gateRow);
}

/**
 * Reads the answer of one scenario, assuming its gate question sits in `gateRow`.
 * Contradictory inputs (the legacy "Eingabe prüfen!" cases) are reported as
 * conflicts and leave the level open.
 */
export function readScenarioAt(
  snapshot: SheetSnapshot,
  goal: Goal,
  def: ScenarioDef,
  gateRow: number,
): { answer: ScenarioAnswer; raw: ScenarioDetection["raw"]; issues: ImportIssue[] } {
  const at = (row: number) => snapshot[row] ?? { B: null, D: null, E: null, F: null, H: null };
  const gateText = at(gateRow).E;
  const optionTexts = optionOffsets(def).map((off) => at(gateRow + off).E);
  const gate = parseYesNo(gateText);
  const opts = optionTexts.map(parseYesNo);
  const issues: ImportIssue[] = [];
  const where = `${GOAL_LABEL[goal]} · ${def.title}`;
  const conflict = (message: string) => issues.push({ severity: "conflict", goal, scenario: def.id, message: `${where}: ${message}` });
  const warn = (message: string) => issues.push({ severity: "warning", goal, scenario: def.id, message: `${where}: ${message}` });

  const answer: ScenarioAnswer = {
    applies: null,
    level: null,
    notes: at(gateRow).F ?? "",
    explanation: at(gateRow).H ?? "",
  };

  for (const [text, parsed] of [[gateText, gate], ...optionTexts.map((t, i) => [t, opts[i]] as const)] as const) {
    if (text && parsed === null) warn(`Unbekannter Wert „${text}“ wurde ignoriert.`);
  }

  if (def.kind === "binary") {
    const follow = opts[0] ?? null;
    if (gate === null) {
      if (follow !== null) warn("Folgefrage beantwortet, Vorfrage jedoch nicht – bitte prüfen.");
    } else if (gate === "Nein") {
      answer.applies = false;
      if (follow === "Ja") conflict("Vorfrage verneint, Gefahr für Leib und Leben jedoch bejaht (Eingabe prüfen).");
    } else {
      answer.applies = true;
      if (follow === null) conflict("Folgefrage zur Gefahr für Leib und Leben ist nicht beantwortet.");
      else answer.level = follow === "Ja" ? 3 : 2;
    }
    return { answer, raw: { gate: gateText, options: optionTexts }, issues };
  }

  const yesIdx = opts.flatMap((o, i) => (o === "Ja" ? [i] : []));
  if (yesIdx.length > 1) {
    answer.applies = gate === null ? null : gate === "Ja";
    conflict("Mehrere Schadensausmaße mit „Ja“ beantwortet (Eingabe prüfen).");
  } else if (gate === "Nein") {
    answer.applies = false;
    if (yesIdx.length === 1) conflict("Vorfrage verneint, Schadensausmaß jedoch bejaht (Eingabe prüfen).");
  } else if (gate === "Ja") {
    answer.applies = true;
    if (yesIdx.length === 0) conflict("Vorfrage bejaht, aber kein Schadensausmaß mit „Ja“ beantwortet (Eingabe prüfen).");
    else answer.level = def.options[yesIdx[0]!]!.level;
  } else if (yesIdx.length === 1) {
    answer.applies = true;
    answer.level = def.options[yesIdx[0]!]!.level;
    warn("Vorfrage nicht beantwortet; aus dem gewählten Schadensausmaß abgeleitet.");
  }
  return { answer, raw: { gate: gateText, options: optionTexts }, issues };
}

// ---------------------------------------------------------------------------
// Workbook parsing

function snapshotOf(ws: ExcelJS.Worksheet): SheetSnapshot {
  const snap: SheetSnapshot = {};
  const last = Math.max(ws.rowCount, 120);
  for (let r = 1; r <= last; r++) {
    const row = ws.getRow(r);
    const entry: SheetRow = {
      B: cellText(row.getCell("B")),
      D: cellText(row.getCell("D")),
      E: cellText(row.getCell("E")),
      F: cellText(row.getCell("F")),
      H: cellText(row.getCell("H")),
    };
    if (entry.B || entry.D || entry.E || entry.F || entry.H) snap[r] = entry;
  }
  return snap;
}

/** Goal header rows found in column B ("Grundwert Vertraulichkeit" ...). */
function goalHeaders(snapshot: SheetSnapshot): Partial<Record<Goal, number>> {
  const found: Partial<Record<Goal, number>> = {};
  for (const [row, r] of Object.entries(snapshot)) {
    for (const goal of GOALS) {
      if (found[goal] === undefined && normalize(r.B) === normalize(CATALOG[goal].title)) found[goal] = Number(row);
    }
  }
  return found;
}

function detect(snapshot: SheetSnapshot, goal: Goal, def: ScenarioDef, headers: Partial<Record<Goal, number>>) {
  const header = headers[goal];
  const offset = header === undefined ? 0 : header - CATALOG[goal].headerRow;
  const expected = def.gateRow + offset;
  if (matchScore(snapshot, def, expected) >= 1.2) {
    return { row: expected, confidence: (offset === 0 ? "exact" : "shifted") as DetectionConfidence };
  }
  // Search within the goal block (up to the next goal header).
  const start = header ?? 1;
  const nextHeaders = Object.values(headers).filter((h): h is number => h !== undefined && h > start);
  const end = nextHeaders.length ? Math.min(...nextHeaders) : Number.MAX_SAFE_INTEGER;
  let best: { row: number; score: number } | null = null;
  for (const key of Object.keys(snapshot)) {
    const row = Number(key);
    if (row <= start || row >= end) continue;
    const score = matchScore(snapshot, def, row);
    if (!best || score > best.score) best = { row, score };
  }
  if (best && best.score >= 1.2) return { row: best.row, confidence: "shifted" as DetectionConfidence };
  return { row: null, confidence: "missing" as DetectionConfidence };
}

function levelFromLabel(text: string | null): 1 | 2 | 3 | null {
  const n = normalize(text);
  for (const l of [3, 2, 1] as const) if (n === normalize(LEVEL_LABEL[l])) return l;
  return null;
}

function overrideKindFromLabel(text: string | null): OverrideKind {
  const n = normalize(text);
  const hit = (Object.entries(OVERRIDE_KIND_LABEL) as [OverrideKind, string][]).find(([, l]) => normalize(l) === n);
  return hit ? hit[0] : "other";
}

function readOverrides(snapshot: SheetSnapshot, headers: Partial<Record<Goal, number>>): Record<Goal, GoalOverride | null> {
  const result: Record<Goal, GoalOverride | null> = { C: null, I: null, A: null };
  const starts = GOALS.map((g) => [g, headers[g]] as const).filter((x): x is readonly [Goal, number] => x[1] !== undefined);
  for (const [row, r] of Object.entries(snapshot)) {
    if (normalize(r.B) !== normalize(OVERRIDE_LABEL)) continue;
    const n = Number(row);
    // The override row belongs to the last goal header above it.
    const owner = starts.filter(([, h]) => h < n).sort((a, b) => b[1] - a[1])[0];
    const level = levelFromLabel(r.E);
    if (!owner || level === null) continue;
    result[owner[0]] = { level, kind: overrideKindFromLabel(r.F), reason: r.D ?? "" };
  }
  return result;
}

function readCover(ws: ExcelJS.Worksheet | undefined, issues: ImportIssue[]) {
  const meta: Partial<AssetMeta> = {};
  const justifications: Record<Goal, string> = { C: "", I: "", A: "" };
  let versionLabel: string | undefined;
  let statusText: string | undefined;
  if (!ws) {
    issues.push({ severity: "warning", message: "Blatt „Deckblatt“ nicht gefunden – Stammdaten bitte manuell ergänzen." });
    return { meta, justifications, versionLabel, statusText };
  }
  const get = (addr: string) => clean(cellText(ws.getCell(addr)));
  const name = get(COVER.name);
  if (name) meta.name = name;
  versionLabel = get(COVER.version) ?? undefined;
  statusText = get(COVER.status) ?? undefined;
  const orgUnit = get(COVER.orgUnit);
  if (orgUnit) meta.orgUnit = orgUnit;
  const contact = get(COVER.contact);
  if (contact) meta.contact = contact;
  const pd = parseBool(cellText(ws.getCell(COVER.personalData)));
  if (pd !== null) meta.personalData = pd;
  const scd = parseBool(cellText(ws.getCell(COVER.specialCategoryData)));
  if (scd !== null) meta.specialCategoryData = scd;

  for (const goal of GOALS) {
    const text = cellText(ws.getCell(`F${COVER.summaryRow[goal]}`)) ?? "";
    // The export appends the override note to the justification; strip it again.
    justifications[goal] = text.split(`\n\n${OVERRIDE_LABEL}`)[0]!.trim();
  }

  // Additional master data block written by this app.
  let inBlock = false;
  const labels = Object.entries(EXTRA_LABEL) as [keyof typeof EXTRA_LABEL, string][];
  for (let r = 1; r <= ws.rowCount; r++) {
    const a = cellText(ws.getCell(`A${r}`));
    if (normalize(a) === normalize(EXTRA_BLOCK_TITLE)) {
      inBlock = true;
      continue;
    }
    if (!inBlock || !a) continue;
    const key = labels.find(([, l]) => normalize(l) === normalize(a))?.[0];
    const value = cellText(ws.getCell(`D${r}`)) ?? "";
    switch (key) {
      case "type": {
        const t = (Object.entries(ASSET_TYPE_LABEL) as [AssetType, string][]).find(
          ([, l]) => normalize(l) === normalize(value),
        );
        if (t) meta.type = t[0];
        break;
      }
      case "owner":
      case "assessor":
      case "description":
      case "scope":
      case "location":
        if (value) meta[key] = value;
        break;
      default:
        break;
    }
  }
  return { meta, justifications, versionLabel, statusText };
}

/** Parses a legacy FS_Schutzbedarfsanalyse workbook or a workbook exported by this app. */
export async function parseLegacyXlsx(data: ArrayBuffer | Uint8Array): Promise<LegacyImport> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(data as ArrayBuffer);
  } catch {
    throw new XlsxImportError("Die Datei konnte nicht als Excel-Arbeitsmappe (.xlsx) gelesen werden.");
  }
  const sheet = findSheet(wb, SHEET.assessment);
  if (!sheet) {
    throw new XlsxImportError(
      "Blatt „Anwendung“ nicht gefunden. Ist dies eine Schutzbedarfsanalyse im Format FS_Schutzbedarfsanalyse?",
    );
  }
  const issues: ImportIssue[] = [];
  const cover = readCover(findSheet(wb, SHEET.cover), issues);
  const snapshot = snapshotOf(sheet);
  const headers = goalHeaders(snapshot);
  for (const goal of GOALS) {
    if (headers[goal] === undefined) {
      issues.push({ severity: "info", goal, message: `Überschrift „${CATALOG[goal].title}“ nicht gefunden; Standardpositionen werden verwendet.` });
    }
  }

  const answers: Answers = { C: {}, I: {}, A: {} };
  const rows: ScenarioDetection[] = [];
  for (const goal of GOALS) {
    for (const def of CATALOG[goal].scenarios) {
      const { row, confidence } = detect(snapshot, goal, def, headers);
      if (row === null) {
        rows.push({ goal, scenario: def.id, row: null, confidence, raw: { gate: null, options: [] } });
        issues.push({
          severity: "conflict",
          goal,
          scenario: def.id,
          message: `${GOAL_LABEL[goal]} · ${def.title}: Frage nicht gefunden – bitte Zeile manuell zuordnen.`,
        });
        continue;
      }
      const read = readScenarioAt(snapshot, goal, def, row);
      rows.push({ goal, scenario: def.id, row, confidence, raw: read.raw });
      issues.push(...read.issues);
      if (read.answer.applies !== null || read.answer.notes || read.answer.explanation) {
        answers[goal][def.id] = read.answer;
      }
    }
  }

  const candidateRows: CandidateRow[] = Object.entries(snapshot)
    .filter(([, r]) => r.D)
    .map(([row, r]) => ({ row: Number(row), text: r.D!, value: r.E }));

  return {
    meta: cover.meta,
    ...(cover.versionLabel ? { versionLabel: cover.versionLabel } : {}),
    ...(cover.statusText ? { statusText: cover.statusText } : {}),
    answers,
    justifications: cover.justifications,
    overrides: readOverrides(snapshot, headers),
    rows,
    issues,
    candidateRows,
    snapshot,
  };
}
