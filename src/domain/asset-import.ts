import type { RawSheet } from "../io/table-read";
import { META_LABEL } from "./diff";
import { parseAssetType } from "./quick-capture";
import type { AssetMeta, AssetType } from "./types";

/**
 * Pure logic of the asset import: header detection, column-mapping
 * suggestions, value mapping for asset types and booleans, and the preview
 * rows with their status.
 */

export type TargetField =
  | "name"
  | "type"
  | "owner"
  | "orgUnit"
  | "contact"
  | "assessor"
  | "description"
  | "scope"
  | "location"
  | "personalData"
  | "specialCategoryData";

export interface TargetFieldDef {
  field: TargetField;
  label: string;
  required?: boolean;
  kind: "text" | "type" | "boolean";
  aliases: string[];
}

export const TARGET_FIELDS: TargetFieldDef[] = [
  {
    field: "name",
    label: META_LABEL.name,
    required: true,
    kind: "text",
    aliases: ["Bezeichnung", "Asset", "Name", "System", "Anwendung", "Titel", "Asset-Name", "Asset-Bezeichnung", "Assetname", "Title", "Asset name", "Objekt", "Zielobjekt"],
  },
  {
    field: "type",
    label: META_LABEL.type,
    kind: "type",
    aliases: ["Typ", "Art", "Kategorie", "Asset-Typ", "Assettyp", "Type", "Category", "Asset type", "Objekttyp", "Klasse"],
  },
  {
    field: "owner",
    label: META_LABEL.owner,
    kind: "text",
    aliases: ["Owner", "Verantwortlich", "Eigentümer", "Asset-Owner", "Verantwortliche(r)", "Verantwortlicher", "Verantwortliche", "Asset Owner", "Besitzer", "Responsible"],
  },
  {
    field: "orgUnit",
    label: META_LABEL.orgUnit,
    kind: "text",
    aliases: ["Abteilung", "Organisationseinheit", "OE", "Bereich", "Department", "Verantwortliche Organisationseinheit", "Org-Einheit", "Fachbereich", "Business unit", "Team"],
  },
  {
    field: "contact",
    label: META_LABEL.contact,
    kind: "text",
    aliases: ["Kontakt", "Ansprechpartner", "Ansprechpartnerin", "E-Mail", "Email", "Mail", "Contact", "Telefon"],
  },
  {
    field: "assessor",
    label: META_LABEL.assessor,
    kind: "text",
    aliases: ["Ersteller", "Ersteller:in", "Erstellerin", "Bearbeiter", "Bearbeiter:in", "Assessor", "Bewerter", "Author", "Autor"],
  },
  {
    field: "description",
    label: META_LABEL.description,
    kind: "text",
    aliases: ["Beschreibung", "Zweck", "Einsatzzweck", "Description", "Beschreibung / Einsatzzweck", "Kurzbeschreibung", "Purpose", "Bemerkung", "Kommentar"],
  },
  {
    field: "scope",
    label: META_LABEL.scope,
    kind: "text",
    aliases: ["Geltungsbereich", "Scope", "Umfang", "Abgrenzung"],
  },
  {
    field: "location",
    label: META_LABEL.location,
    kind: "text",
    aliases: ["Standort", "Ort", "Rechenzentrum", "Location", "Site", "Hosting", "Region"],
  },
  {
    field: "personalData",
    label: META_LABEL.personalData,
    kind: "boolean",
    aliases: ["Personenbezogene Daten", "PII", "DSGVO", "personal data", "Personenbezug", "PBD", "Personal data (PII)", "DSGVO-relevant"],
  },
  {
    field: "specialCategoryData",
    label: META_LABEL.specialCategoryData,
    kind: "boolean",
    aliases: ["Art. 9", "Art 9", "besondere Kategorien", "Besondere Kategorien personenbezogener Daten", "Gesundheitsdaten", "special category", "special category data", "Art. 9 DSGVO", "sensible Daten"],
  },
];

const FIELD_ORDER: TargetField[] = TARGET_FIELDS.map((f) => f.field);

export interface ImportTable {
  headers: string[];
  rows: string[][];
}

export type ColumnMapping = Record<TargetField, number | null>;

export function emptyMapping(): ColumnMapping {
  return Object.fromEntries(FIELD_ORDER.map((f) => [f, null])) as ColumnMapping;
}

/** Lowercase, umlauts folded, "(pflicht)" and punctuation removed, whitespace collapsed. */
export function normalizeHeader(text: string): string {
  return text
    .toLowerCase()
    .replace(/\(\s*pflicht\s*\)|\*|\(required\)/g, " ")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** 0..1 similarity of a header to a field (1 = exact alias match). */
function headerScore(header: string, def: TargetFieldDef): number {
  const h = normalizeHeader(header);
  if (!h) return 0;
  let best = 0;
  for (const alias of [def.label, ...def.aliases]) {
    const a = normalizeHeader(alias);
    if (!a) continue;
    if (h === a) return 1;
    const hw = h.split(" ");
    const aw = a.split(" ");
    // All alias words present as whole words in the header ("Asset-Owner (IT)" → owner).
    if (aw.every((w) => hw.includes(w))) best = Math.max(best, 0.8 - 0.05 * (hw.length - aw.length));
    // Header is a whole-word part of a longer alias ("Organisationseinheit" in "Verantwortliche Organisationseinheit").
    else if (hw.every((w) => aw.includes(w)) && h.length >= 3) best = Math.max(best, 0.6);
    // Prefix matches for compound words ("Standortbezeichnung" → Standort), only for longer aliases.
    else if (a.length >= 5 && (h.startsWith(a) || hw.some((w) => w.startsWith(a)))) best = Math.max(best, 0.5);
  }
  return best;
}

const MIN_HEADER_SCORE = 0.45;

function isNumericLike(value: string): boolean {
  return /^[\s\d.,:/+\-%€$]+$/.test(value);
}

/** Heuristic: the first non-empty row is a header row. */
export function detectHeaderRow(sheet: RawSheet): boolean {
  const rows = sheet.rows.filter((r) => r.some((c) => c !== ""));
  const first = rows[0];
  if (!first) return false;
  const cells = first.filter((c) => c !== "");
  if (cells.length === 0) return false;
  // Headers are text, not numbers or dates.
  if (cells.some(isNumericLike)) return false;
  const rest = rows.slice(1);
  // Header cells differ from the values below them ("Anwendung" repeating in a type column is data).
  const repeatsBelow = first.some((c, i) => c !== "" && rest.some((r) => (r[i] ?? "").toLowerCase() === c.toLowerCase()));
  if (repeatsBelow) return false;
  // A cell matching a known field alias is a strong signal – unless it is itself an
  // asset type sitting on top of a column of asset types.
  const typeColumn = (i: number) => {
    const below = rest.map((r) => r[i] ?? "").filter((v) => v !== "");
    return below.length > 0 && below.filter((v) => parseAssetType(v) !== null).length / below.length >= 0.6;
  };
  // A header is never itself one of the values of a type column.
  if (first.some((c, i) => c !== "" && parseAssetType(c) !== null && typeColumn(i))) return false;
  const aliasHits = first.filter((c) => c !== "" && TARGET_FIELDS.some((d) => headerScore(c, d) >= 0.8)).length;
  if (aliasHits >= 1) return true;
  if (rest.length === 0) return false;
  // Header cells are unique.
  if (new Set(cells.map((c) => c.toLowerCase())).size !== cells.length) return false;
  // Columns that hold numbers below a text cell point to a header.
  const numericBelow = first.some((c, i) => c !== "" && rest.slice(0, 20).some((r) => r[i] && isNumericLike(r[i]!)));
  // Header cells are usually shorter than the values below.
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const headerLen = avg(cells.map((c) => c.length));
  const valueLen = avg(rest.slice(0, 20).flatMap((r) => r.filter((c) => c !== "").map((c) => c.length)));
  return numericBelow || headerLen <= valueLen * 0.9;
}

function columnLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Table with headers; the source row index is kept for line numbers via `sourceLines`. */
export function toTable(sheet: RawSheet, headerRow: boolean): ImportTable {
  const width = sheet.rows.reduce((w, r) => Math.max(w, r.length), 0);
  const pad = (r: string[]) => {
    const out = r.slice(0, width);
    while (out.length < width) out.push("");
    return out;
  };
  const firstIndex = sheet.rows.findIndex((r) => r.some((c) => c !== ""));
  const headerCells = headerRow && firstIndex >= 0 ? pad(sheet.rows[firstIndex]!) : null;
  const headers = Array.from({ length: width }, (_, i) => headerCells?.[i] || `Spalte ${columnLetter(i)}`);
  const lines: number[] = [];
  const rows: string[][] = [];
  sheet.rows.forEach((r, i) => {
    if (headerRow && i <= firstIndex) return;
    if (!r.some((c) => c !== "")) return;
    rows.push(pad(r));
    lines.push(i + 1);
  });
  const table: ImportTable = { headers, rows };
  SOURCE_LINES.set(table, lines);
  return table;
}

/** 1-based source line of each table row (tables built by toTable). */
const SOURCE_LINES = new WeakMap<ImportTable, number[]>();

function sourceLine(table: ImportTable, index: number, fallbackOffset: number): number {
  return SOURCE_LINES.get(table)?.[index] ?? index + 1 + fallbackOffset;
}

export function distinctValues(table: ImportTable, column: number, limit = 50): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of table.rows) {
    const v = (r[column] ?? "").trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

function columnValues(table: ImportTable, column: number): string[] {
  return table.rows.map((r) => (r[column] ?? "").trim()).filter((v) => v !== "");
}

export function suggestMapping(table: ImportTable): ColumnMapping {
  const mapping = emptyMapping();
  const used = new Set<number>();

  // 1. Header aliases: assign the globally best (field, column) pairs first.
  const candidates: { field: TargetField; column: number; score: number }[] = [];
  for (const def of TARGET_FIELDS) {
    table.headers.forEach((h, column) => {
      const score = headerScore(h, def);
      if (score >= MIN_HEADER_SCORE) candidates.push({ field: def.field, column, score });
    });
  }
  candidates.sort((a, b) => b.score - a.score || FIELD_ORDER.indexOf(a.field) - FIELD_ORDER.indexOf(b.field) || a.column - b.column);
  for (const c of candidates) {
    if (mapping[c.field] !== null || used.has(c.column)) continue;
    mapping[c.field] = c.column;
    used.add(c.column);
  }

  // 2. Type column by content: most values parse as asset types.
  if (mapping.type === null) {
    let best: { column: number; ratio: number } | null = null;
    table.headers.forEach((_, column) => {
      if (used.has(column)) return;
      const values = columnValues(table, column);
      if (values.length === 0) return;
      const ratio = values.filter((v) => parseAssetType(v) !== null).length / values.length;
      if (ratio >= 0.6 && (!best || ratio > best.ratio)) best = { column, ratio };
    });
    if (best) {
      mapping.type = (best as { column: number }).column;
      used.add(mapping.type);
    }
  }

  // 3. Name fallback: first mostly-text column with mostly unique values.
  if (mapping.name === null) {
    for (let column = 0; column < table.headers.length; column++) {
      if (used.has(column)) continue;
      const values = columnValues(table, column);
      if (values.length === 0) continue;
      const text = values.filter((v) => !isNumericLike(v)).length / values.length;
      const unique = new Set(values.map((v) => v.toLowerCase())).size / values.length;
      if (text >= 0.8 && unique >= 0.8) {
        mapping.name = column;
        used.add(column);
        break;
      }
    }
  }
  return mapping;
}

export function suggestTypeMapping(values: string[]): Record<string, AssetType | null> {
  return Object.fromEntries(values.map((v) => [v, parseAssetType(v)]));
}

const TRUE_WORDS = new Set(["ja", "j", "yes", "y", "x", "✓", "✔", "1", "true", "wahr", "zutreffend", "vorhanden"]);
const FALSE_WORDS = new Set(["nein", "n", "no", "0", "false", "falsch", "-", "–", "nicht zutreffend", "keine", "kein"]);

export function parseBoolean(text: string): boolean | null {
  const key = text.trim().toLowerCase();
  if (!key) return null;
  if (TRUE_WORDS.has(key)) return true;
  if (FALSE_WORDS.has(key)) return false;
  return null;
}

export type ImportRowStatus = "new" | "duplicate-in-file" | "exists" | "invalid";

export interface ImportRow {
  line: number;
  meta: Partial<AssetMeta> & { name: string; type: AssetType };
  status: ImportRowStatus;
  message?: string;
}

const TEXT_FIELDS = ["owner", "orgUnit", "contact", "assessor", "description", "scope", "location"] as const;

export function buildImportRows(
  table: ImportTable,
  mapping: ColumnMapping,
  typeMap: Record<string, AssetType | null>,
  opts: { defaultType: AssetType; existingNames: Iterable<string> },
): ImportRow[] {
  const existing = new Set(Array.from(opts.existingNames, (n) => n.trim().toLowerCase()));
  const seen = new Set<string>();
  const cell = (row: string[], field: TargetField) => {
    const col = mapping[field];
    return col === null ? "" : (row[col] ?? "").trim();
  };
  // Tables not built by toTable: assume one header line.
  const headerOffset = 1;

  return table.rows.map((row, index) => {
    const name = cell(row, "name");
    const rawType = cell(row, "type");
    const type = (rawType ? typeMap[rawType] : null) ?? opts.defaultType;
    const meta: ImportRow["meta"] = { name, type };
    for (const f of TEXT_FIELDS) {
      if (mapping[f] === null) continue;
      const v = cell(row, f);
      if (v) meta[f] = v;
    }
    for (const f of ["personalData", "specialCategoryData"] as const) {
      if (mapping[f] === null) continue;
      const b = parseBoolean(cell(row, f));
      if (b !== null) meta[f] = b;
    }
    const line = sourceLine(table, index, headerOffset);
    if (!name) return { line, meta, status: "invalid", message: "Bezeichnung fehlt" };
    const key = name.toLowerCase();
    if (seen.has(key)) return { line, meta, status: "duplicate-in-file", message: "Mehrfach in der Datei" };
    seen.add(key);
    if (existing.has(key)) return { line, meta, status: "exists", message: "Existiert bereits" };
    return { line, meta, status: "new" };
  });
}
