/**
 * Reads tabular files (CSV/TSV, XLSX, ODS) into plain text grids for the asset
 * import. Browser and node compatible; ExcelJS and the zip/XML libraries are
 * loaded on demand.
 */

export interface RawSheet {
  name: string;
  rows: string[][];
}

export class TableReadError extends Error {}

/** Upper bound for repeated rows/columns in ODS (sheets often end with ~1M empty repeats). */
const MAX_REPEAT = 1024;
/** Upper bound for rows read from one sheet. */
const MAX_ROWS = 20_000;

function toBytes(data: ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

function baseName(fileName: string): string {
  const name = fileName.replace(/^.*[\\/]/, "");
  const dot = name.lastIndexOf(".");
  return (dot > 0 ? name.slice(0, dot) : name) || "Tabelle";
}

function extension(fileName: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(fileName);
  return m ? m[1]!.toLowerCase() : "";
}

function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

/** Trims, normalizes non-breaking spaces and line endings. */
function clean(text: string): string {
  return text.replace(/ /g, " ").replace(/\r\n?/g, "\n").trim();
}

/**
 * Pads rows to equal width and removes fully empty trailing rows and columns.
 * Leading/inner empty rows are kept so row numbers match the source.
 */
function normalize(rows: string[][]): string[][] {
  const trimmed = rows.map((r) => r.map((c) => clean(c ?? "")));
  let last = trimmed.length - 1;
  while (last >= 0 && trimmed[last]!.every((c) => c === "")) last--;
  const kept = trimmed.slice(0, last + 1);
  let width = 0;
  for (const r of kept) {
    for (let i = r.length - 1; i >= 0; i--) {
      if (r[i] !== "") {
        width = Math.max(width, i + 1);
        break;
      }
    }
  }
  return kept.map((r) => {
    const out = r.slice(0, width);
    while (out.length < width) out.push("");
    return out;
  });
}

export function detectTableFormat(fileName: string, bytes: Uint8Array): "csv" | "xlsx" | "ods" | null {
  if (isZip(bytes)) {
    // Both are zip packages; ODS starts with an uncompressed "mimetype" entry.
    const head = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 200)));
    if (head.includes("mimetypeapplication/vnd.oasis.opendocument.spreadsheet")) return "ods";
    const ext = extension(fileName);
    if (ext === "ods") return "ods";
    if (ext === "xlsx" || ext === "xlsm") return "xlsx";
    if (head.includes("[Content_Types].xml") || head.includes("xl/") || head.includes("_rels/")) return "xlsx";
    return "xlsx";
  }
  const ext = extension(fileName);
  if (["csv", "tsv", "txt", "tab"].includes(ext)) return "csv";
  if (ext === "xls") return null; // legacy binary Excel is not supported
  // Plain text without a known extension: accept if it decodes and has no NUL bytes.
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  if (sample.length > 0 && !sample.includes(0)) return "csv";
  return null;
}

export async function readTableFile(fileName: string, data: ArrayBuffer | Uint8Array): Promise<RawSheet[]> {
  const bytes = toBytes(data);
  if (bytes.length === 0) throw new TableReadError("Die Datei ist leer.");
  const format = detectTableFormat(fileName, bytes);
  if (format === null) {
    throw new TableReadError(
      extension(fileName) === "xls"
        ? "Das alte Excel-Format (.xls) wird nicht unterstützt. Bitte als .xlsx oder .csv speichern."
        : "Dieses Dateiformat wird nicht unterstützt. Möglich sind CSV, Excel (.xlsx) und OpenDocument (.ods).",
    );
  }
  let sheets: RawSheet[];
  if (format === "csv") sheets = [{ name: baseName(fileName), rows: normalize(parseCsv(decodeText(bytes))) }];
  else if (format === "xlsx") sheets = await readXlsx(bytes);
  else sheets = await readOds(bytes);
  const withData = sheets.filter((s) => s.rows.length > 0);
  if (withData.length === 0) throw new TableReadError("Die Datei enthält keine Daten.");
  return withData;
}

// ---------------------------------------------------------------------------
// CSV

/** UTF-8 (with or without BOM); falls back to Windows-1252 as written by German Excel. */
export function decodeText(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  return text.replace(/^﻿/, "");
}

const DELIMITERS = [";", ",", "\t", "|"] as const;

/** RFC 4180 parser for one delimiter: quoted fields, "" escapes, line breaks inside quotes. */
function parseWith(text: string, delimiter: string, limitRows = Infinity): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && field.trim() === "") {
      quoted = true;
      field = "";
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      row.push(field);
      rows.push(row);
      if (rows.length >= limitRows) return rows;
      row = [];
      field = "";
      i += ch === "\r" && text[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    field += ch;
    i++;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Picks the delimiter whose sample lines have the most consistent column count (>1). */
export function detectDelimiter(text: string): string {
  let best: { d: string; score: number } = { d: ";", score: -Infinity };
  for (const d of DELIMITERS) {
    const sample = parseWith(text, d, 20).filter((r) => r.some((c) => c.trim() !== ""));
    if (sample.length === 0) continue;
    const counts = sample.map((r) => r.length);
    const first = counts[0]!;
    if (first < 2 && counts.every((c) => c < 2)) continue;
    const consistent = counts.filter((c) => c === first).length / counts.length;
    // Consistency matters most; more columns break ties (e.g. text containing commas).
    const score = consistent * 100 + Math.min(first, 50);
    if (score > best.score) best = { d, score };
  }
  return best.d;
}

export function parseCsv(text: string): string[][] {
  if (!text.trim()) return [];
  return parseWith(text, detectDelimiter(text), MAX_ROWS);
}

// ---------------------------------------------------------------------------
// XLSX

const dateFormat = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  // Remove binary float artefacts such as 0.1 + 0.2 = 0.30000000000000004.
  return String(Number(n.toPrecision(12))).replace(".", ",");
}

type ExcelValue = unknown;

function excelText(value: ExcelValue, fallback: string): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return dateFormat.format(value);
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "boolean") return value ? "WAHR" : "FALSCH";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText)) return (v.richText as { text: string }[]).map((r) => r.text).join("");
    if ("result" in v) return excelText(v.result, "");
    if ("formula" in v || "sharedFormula" in v) return "";
    if (typeof v.text === "string") return v.text; // hyperlink
    if ("error" in v) return "";
  }
  return fallback;
}

async function readXlsx(bytes: Uint8Array): Promise<RawSheet[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  } catch {
    throw new TableReadError("Die Excel-Datei ist beschädigt oder kein .xlsx-Format.");
  }
  const sheets: RawSheet[] = [];
  wb.eachSheet((ws) => {
    if (ws.state && ws.state !== "visible") return;
    const rows: string[][] = [];
    const last = Math.min(ws.rowCount, MAX_ROWS);
    for (let r = 1; r <= last; r++) {
      const row = ws.getRow(r);
      const cells: string[] = [];
      const width = Math.min(row.cellCount, 500);
      for (let c = 1; c <= width; c++) {
        const cell = row.getCell(c);
        let text = "";
        try {
          text = excelText(cell.value, "");
          if (!text && cell.value !== null && cell.value !== undefined && typeof cell.value === "object") text = cell.text ?? "";
        } catch {
          text = "";
        }
        cells.push(text);
      }
      rows.push(cells);
    }
    sheets.push({ name: ws.name, rows: normalize(rows) });
  });
  return sheets;
}

// ---------------------------------------------------------------------------
// ODS

type XmlNode = Record<string, unknown> & { ":@"?: Record<string, string> };

function tagOf(node: XmlNode): string | undefined {
  return Object.keys(node).find((k) => k !== ":@");
}

function children(node: XmlNode): XmlNode[] {
  const tag = tagOf(node);
  const c = tag ? node[tag] : undefined;
  return Array.isArray(c) ? (c as XmlNode[]) : [];
}

function attr(node: XmlNode, name: string): string | undefined {
  return node[":@"]?.[`@_${name}`];
}

function inlineText(nodes: XmlNode[]): string {
  let out = "";
  for (const n of nodes) {
    const tag = tagOf(n);
    if (tag === "#text") out += String(n["#text"]);
    else if (tag === "text:s") out += " ".repeat(Number(attr(n, "text:c") ?? 1));
    else if (tag === "text:tab") out += "\t";
    else if (tag === "text:line-break") out += "\n";
    else if (tag === "office:annotation") continue;
    else out += inlineText(children(n));
  }
  return out;
}

function odsCellText(cell: XmlNode): string {
  const paras = children(cell).filter((c) => tagOf(c) === "text:p");
  if (paras.length) return paras.map((p) => inlineText(children(p))).join("\n");
  const type = attr(cell, "office:value-type");
  if (type === "date") {
    const d = attr(cell, "office:date-value");
    if (d) {
      const date = new Date(d.length === 10 ? `${d}T00:00:00Z` : d);
      if (!Number.isNaN(date.getTime())) return dateFormat.format(date);
    }
  }
  const value = attr(cell, "office:string-value") ?? attr(cell, "office:value") ?? attr(cell, "office:boolean-value");
  if (value === undefined) return "";
  if (type === "float" || type === "percentage" || type === "currency") {
    const n = Number(value);
    if (Number.isFinite(n)) return formatNumber(n);
  }
  return value;
}

function findNodes(nodes: XmlNode[], wanted: string, out: XmlNode[] = []): XmlNode[] {
  for (const n of nodes) {
    const tag = tagOf(n);
    if (tag === wanted) out.push(n);
    else if (tag && tag !== "#text") findNodes(children(n), wanted, out);
  }
  return out;
}

/** Names of table styles that hide a sheet (style:table-properties table:display="false"). */
function hiddenTableStyles(doc: XmlNode[]): Set<string> {
  const hidden = new Set<string>();
  for (const s of findNodes(doc, "style:style")) {
    if (attr(s, "style:family") !== "table") continue;
    const props = children(s).find((c) => tagOf(c) === "style:table-properties");
    if (props && attr(props, "table:display") === "false") hidden.add(attr(s, "style:name") ?? "");
  }
  return hidden;
}

/** Reads one table:table element into a text grid (repeats capped, covered cells empty). */
export function odsTableRows(table: XmlNode): string[][] {
  const rows: string[][] = [];
  const visit = (nodes: XmlNode[]) => {
    for (const n of nodes) {
      if (rows.length >= MAX_ROWS) return;
      const tag = tagOf(n);
      if (tag === "table:table-header-rows" || tag === "table:table-row-group" || tag === "table:table-rows") {
        visit(children(n));
        continue;
      }
      if (tag !== "table:table-row") continue;
      const row: string[] = [];
      for (const c of children(n)) {
        const ct = tagOf(c);
        if (ct !== "table:table-cell" && ct !== "table:covered-table-cell") continue;
        const repeat = Math.min(Number(attr(c, "table:number-columns-repeated") ?? 1), MAX_REPEAT);
        const text = ct === "table:table-cell" ? odsCellText(c) : "";
        for (let i = 0; i < repeat; i++) row.push(text);
      }
      const repeat = Math.min(Number(attr(n, "table:number-rows-repeated") ?? 1), MAX_REPEAT);
      for (let i = 0; i < repeat && rows.length < MAX_ROWS; i++) rows.push([...row]);
    }
  };
  visit(children(table));
  return rows;
}

async function readOds(bytes: Uint8Array): Promise<RawSheet[]> {
  const [{ strFromU8, unzipSync }, { XMLParser }] = await Promise.all([import("fflate"), import("fast-xml-parser")]);
  let content: string;
  try {
    const files = unzipSync(bytes, { filter: (f) => f.name === "content.xml" });
    const raw = files["content.xml"];
    if (!raw) throw new Error("content.xml missing");
    content = strFromU8(raw);
  } catch {
    throw new TableReadError("Die Datei konnte nicht als OpenDocument-Tabelle (.ods) gelesen werden.");
  }
  const parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    processEntities: true,
  });
  const doc = parser.parse(content) as XmlNode[];
  const hidden = hiddenTableStyles(doc);
  return findNodes(doc, "table:table")
    .filter((t) => !hidden.has(attr(t, "table:style-name") ?? ""))
    .map((t) => ({ name: attr(t, "table:name") ?? "Tabelle", rows: normalize(odsTableRows(t)) }));
}
