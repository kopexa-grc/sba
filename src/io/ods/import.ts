import { strFromU8, unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { parseLegacyXlsx, parseWorkbook, tidyText, XlsxImportError, type LegacyImport, type SheetReader, type WorkbookReader } from "../xlsx/import";
import { colName } from "./model";
import { ODS_MIME } from "./package";

/** Node in fast-xml-parser's "preserveOrder" output: one tag key plus optional attributes. */
type XmlNode = Record<string, unknown> & { ":@"?: Record<string, string> };

/** Guard against absurd repeat counts (sheets often end with ~1M repeated empty rows). */
const MAX_REPEAT = 1024;

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

/** Text of an inline element (text:p, text:span, ...), honouring text:s, tabs and line breaks. */
function inlineText(nodes: XmlNode[]): string {
  let out = "";
  for (const n of nodes) {
    const tag = tagOf(n);
    if (tag === "#text") out += String(n["#text"]);
    else if (tag === "text:s") out += " ".repeat(Number(attr(n, "text:c") ?? 1));
    else if (tag === "text:tab") out += "\t";
    else if (tag === "text:line-break") out += "\n";
    else if (tag === "text:annotation") continue;
    else out += inlineText(children(n));
  }
  return out;
}

function cellText(cell: XmlNode): string | null {
  const paras = children(cell).filter((c) => tagOf(c) === "text:p");
  if (paras.length) return tidyText(paras.map((p) => inlineText(children(p))).join("\n"));
  const value = attr(cell, "office:string-value") ?? attr(cell, "office:value") ?? attr(cell, "office:date-value") ?? attr(cell, "office:boolean-value");
  return tidyText(value);
}

interface ParsedTable {
  name: string;
  cells: Map<string, string>;
  rowCount: number;
}

function readTable(table: XmlNode): ParsedTable {
  const cells = new Map<string, string>();
  let row = 0;
  let rowCount = 0;
  const visitRows = (nodes: XmlNode[]) => {
    for (const n of nodes) {
      const tag = tagOf(n);
      if (tag === "table:table-header-rows" || tag === "table:table-row-group" || tag === "table:table-rows") {
        visitRows(children(n));
        continue;
      }
      if (tag !== "table:table-row") continue;
      const repeat = Number(attr(n, "table:number-rows-repeated") ?? 1);
      const rowCells: [number, string][] = [];
      let col = 0;
      for (const c of children(n)) {
        const ct = tagOf(c);
        if (ct !== "table:table-cell" && ct !== "table:covered-table-cell") continue;
        const cRepeat = Number(attr(c, "table:number-columns-repeated") ?? 1);
        const text = ct === "table:table-cell" ? cellText(c) : null;
        if (text !== null) for (let i = 0; i < Math.min(cRepeat, MAX_REPEAT); i++) rowCells.push([col + 1 + i, text]);
        col += cRepeat;
      }
      if (rowCells.length) {
        const n = Math.min(repeat, MAX_REPEAT);
        for (let i = 0; i < n; i++) for (const [c, text] of rowCells) cells.set(`${colName(c)}${row + 1 + i}`, text);
        rowCount = row + n;
      }
      row += repeat;
    }
  };
  visitRows(children(table));
  return { name: attr(table, "table:name") ?? "", cells, rowCount };
}

function findTables(nodes: XmlNode[], out: XmlNode[] = []): XmlNode[] {
  for (const n of nodes) {
    const tag = tagOf(n);
    if (tag === "table:table") out.push(n);
    else if (tag && tag !== "#text") findTables(children(n), out);
  }
  return out;
}

/** Reads all sheets of an .ods package into a format-neutral workbook reader. */
export function odsReader(data: ArrayBuffer | Uint8Array): WorkbookReader {
  let content: string;
  try {
    const files = unzipSync(data instanceof Uint8Array ? data : new Uint8Array(data), {
      filter: (f) => f.name === "content.xml",
    });
    const raw = files["content.xml"];
    if (!raw) throw new Error("content.xml missing");
    content = strFromU8(raw);
  } catch {
    throw new XlsxImportError("Die Datei konnte nicht als OpenDocument-Tabelle (.ods) gelesen werden.");
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
  const tables = findTables(doc).map(readTable);
  return {
    sheet(name) {
      const wanted = name.trim().toLowerCase();
      const t = tables.find((x) => x.name.trim().toLowerCase() === wanted);
      if (!t) return undefined;
      const reader: SheetReader = { cell: (address) => t.cells.get(address.toUpperCase()) ?? null, rowCount: t.rowCount };
      return reader;
    },
  };
}

/** Parses a legacy form or an app export saved as OpenDocument spreadsheet (.ods). */
export async function parseLegacyOds(data: ArrayBuffer | Uint8Array): Promise<LegacyImport> {
  return parseWorkbook(odsReader(data));
}

/** Detects XLSX or ODS by the zip contents; null for anything else. */
export function detectSpreadsheetFormat(data: ArrayBuffer | Uint8Array): "xlsx" | "ods" | null {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return null;
  try {
    const files = unzipSync(bytes, { filter: (f) => f.name === "mimetype" || f.name === "[Content_Types].xml" });
    if (files.mimetype && strFromU8(files.mimetype).trim() === ODS_MIME) return "ods";
    if (files["[Content_Types].xml"]) return "xlsx";
  } catch {
    return null;
  }
  return null;
}

/** Parses either format, detected from the file content. */
export async function parseLegacySpreadsheet(data: ArrayBuffer | Uint8Array): Promise<LegacyImport> {
  const format = detectSpreadsheetFormat(data);
  if (format === "ods") return parseLegacyOds(data);
  if (format === "xlsx") return parseLegacyXlsx(data);
  throw new XlsxImportError("Die Datei ist weder eine Excel-Arbeitsmappe (.xlsx) noch eine OpenDocument-Tabelle (.ods).");
}
