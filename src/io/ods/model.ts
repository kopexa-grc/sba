/**
 * Minimal in-memory spreadsheet model that serializes to OpenDocument
 * (content.xml). Only the features the SBA report needs: typed cells,
 * OpenFormula formulas with cached results, merges, column widths, row
 * heights, cell styles with conditional maps and list validations.
 */

export interface CellStyle {
  bold?: boolean;
  /** Font size in pt. */
  size?: number;
  /** Text colour, "#rrggbb". */
  color?: string;
  /** Background colour, "#rrggbb". */
  bg?: string;
  wrap?: boolean;
  align?: "start" | "center" | "end";
  valign?: "top" | "middle" | "bottom";
  border?: boolean;
  /** Rotation in degrees (e.g. 90 for vertical text). */
  rotate?: number;
  /** Named data style, e.g. "N_DATE" or "N_DATETIME". */
  dataStyle?: string;
  /** Conditional formatting: cell content equals value -> named style. */
  maps?: { equals: string; style: string }[];
  /** Validation name to attach (list validation). */
  validation?: string;
}

export type CellValue =
  | { kind: "string"; text: string }
  | { kind: "float"; value: number }
  | { kind: "date"; iso: string; text: string }
  | { kind: "boolean"; value: boolean };

export interface Cell {
  value?: CellValue;
  /** OpenFormula including the "of:=" prefix. */
  formula?: string;
  style?: CellStyle;
  colSpan?: number;
  rowSpan?: number;
}

export interface Validation {
  name: string;
  /** Allowed values of a list validation. */
  list: string[];
}

export interface Shape {
  /** Path inside the package, e.g. "Pictures/logo.png". */
  href: string;
  x: string;
  y: string;
  width: string;
  height: string;
}

export class OdsSheet {
  readonly cells = new Map<string, Cell>();
  readonly colWidths = new Map<number, number>();
  readonly rowHeights = new Map<number, number>();
  readonly shapes: Shape[] = [];
  hidden = false;
  landscape = false;
  /** Range with filter buttons, e.g. "A1:H10". */
  filterRange: string | null = null;

  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  private key(row: number, col: number) {
    return `${row}:${col}`;
  }

  get(address: string): Cell {
    const { row, col } = parseAddress(address);
    return this.at(row, col);
  }

  at(row: number, col: number): Cell {
    const k = this.key(row, col);
    let c = this.cells.get(k);
    if (!c) {
      c = {};
      this.cells.set(k, c);
    }
    return c;
  }

  /** Sets text/number/date/boolean with an optional style; undefined/null leaves the cell empty. */
  set(address: string, value: string | number | boolean | null | undefined, style?: CellStyle): Cell {
    const c = this.get(address);
    c.value = toValue(value);
    if (style) c.style = { ...c.style, ...style };
    return c;
  }

  setDate(address: string, iso: string | null | undefined, withTime: boolean, style?: CellStyle): Cell {
    const c = this.get(address);
    if (iso) c.value = { kind: "date", iso: odfDate(iso), text: formatDate(iso, withTime) };
    c.style = { ...c.style, ...style, dataStyle: withTime ? "N_DATETIME" : "N_DATE" };
    return c;
  }

  /** Formula in Excel notation (without "="), stored as OpenFormula with its cached result. */
  setFormula(address: string, excelFormula: string, result: string | number | boolean, style?: CellStyle): Cell {
    const c = this.get(address);
    c.formula = excelToOpenFormula(excelFormula);
    c.value = toValue(result) ?? { kind: "string", text: "" };
    if (style) c.style = { ...c.style, ...style };
    return c;
  }

  style(address: string, style: CellStyle) {
    const c = this.get(address);
    c.style = { ...c.style, ...style };
  }

  merge(range: string) {
    const [a, b] = range.split(":");
    const s = parseAddress(a!);
    const e = parseAddress(b ?? a!);
    const c = this.at(s.row, s.col);
    c.colSpan = e.col - s.col + 1;
    c.rowSpan = e.row - s.row + 1;
  }

  /** Width in Excel character units (as in the XLSX export). */
  width(col: string, chars: number) {
    this.colWidths.set(colIndex(col), chars);
  }

  /** Row height in pt. */
  height(row: number, pt: number) {
    this.rowHeights.set(row, pt);
  }

  get maxRow(): number {
    let m = 0;
    for (const [k, c] of this.cells) {
      const r = Number(k.split(":")[0]);
      m = Math.max(m, r + (c.rowSpan ?? 1) - 1);
    }
    return m;
  }

  get maxCol(): number {
    let m = Math.max(0, ...this.colWidths.keys());
    for (const [k, c] of this.cells) {
      const col = Number(k.split(":")[1]);
      m = Math.max(m, col + (c.colSpan ?? 1) - 1);
    }
    return m;
  }
}

function toValue(v: string | number | boolean | null | undefined): CellValue | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  if (typeof v === "number") return { kind: "float", value: v };
  if (typeof v === "boolean") return { kind: "boolean", value: v };
  return { kind: "string", text: v };
}

// ---------------------------------------------------------------------------
// Addresses and formulas

export function colIndex(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export function colName(index: number): string {
  let s = "";
  let n = index;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function parseAddress(address: string): { row: number; col: number } {
  const m = /^\$?([A-Z]{1,3})\$?(\d+)$/i.exec(address.trim());
  if (!m) throw new Error(`Invalid cell address: ${address}`);
  return { col: colIndex(m[1]!), row: Number(m[2]) };
}

export function quoteSheet(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`;
}

const REF = /^(?:([A-Za-zÄÖÜäöüß][\wÄÖÜäöüß-]*)!)?(\$?[A-Z]{1,3}\$?\d+)(?::(\$?[A-Z]{1,3}\$?\d+))?/;

/**
 * Converts an Excel formula (without "=") to OpenFormula: references in
 * brackets, sheet references with "$Sheet.", ";" as argument separator.
 */
export function excelToOpenFormula(formula: string): string {
  let out = "";
  let i = 0;
  while (i < formula.length) {
    const ch = formula[i]!;
    if (ch === '"') {
      let j = i + 1;
      while (j < formula.length) {
        if (formula[j] === '"' && formula[j + 1] === '"') j += 2;
        else if (formula[j] === '"') break;
        else j++;
      }
      out += formula.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    const prev = i > 0 ? formula[i - 1]! : "";
    if (!/[A-Za-z0-9_.]/.test(prev)) {
      const m = REF.exec(formula.slice(i));
      if (m && formula[i + m[0].length] !== "(") {
        const sheet = m[1] ? `$${quoteSheet(m[1])}` : "";
        out += m[3] ? `[${sheet}.${m[2]}:.${m[3]}]` : `[${sheet}.${m[2]}]`;
        i += m[0].length;
        continue;
      }
    }
    out += ch === "," ? ";" : ch;
    i++;
  }
  return `of:=${out}`;
}

// ---------------------------------------------------------------------------
// Dates

/** "2026-09-29T14:26:40.967Z" -> "2026-09-29T14:26:40" (UTC components, as in the XLSX export). */
export function odfDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 19);
}

export function formatDate(iso: string, withTime: boolean): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  const date = `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
  return withTime ? `${date} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` : date;
}
