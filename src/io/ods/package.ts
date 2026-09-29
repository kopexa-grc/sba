import { strToU8, zipSync, type Zippable } from "fflate";
import { colName, quoteSheet, type Cell, type CellStyle, type OdsSheet, type Validation } from "./model";

export const ODS_MIME = "application/vnd.oasis.opendocument.spreadsheet";

const NS = [
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
  'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"',
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"',
  'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"',
  'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"',
  'xmlns:xlink="http://www.w3.org/1999/xlink"',
  'xmlns:dc="http://purl.org/dc/elements/1.1/"',
  'xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"',
  'xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0"',
  'xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"',
  'xmlns:of="urn:oasis:names:tc:opendocument:xmlns:of:1.2"',
  'xmlns:calcext="urn:org:documentfoundation:names:experimental:calc:xmlns:calcext:1.0"',
  'office:version="1.3"',
].join(" ");

export function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Text content as <text:p> paragraphs; keeps line breaks, runs of spaces and tabs. */
function paragraphs(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const body = esc(line)
        .replace(/\t/g, "<text:tab/>")
        .replace(/ {2,}/g, (m) => ` <text:s text:c="${m.length - 1}"/>`);
      return `<text:p>${body}</text:p>`;
    })
    .join("");
}

/** Named styles referenced by conditional maps (they must live in styles.xml). */
export interface NamedStyle {
  name: string;
  color: string;
  bg?: string;
  bold?: boolean;
}

// ---------------------------------------------------------------------------
// Automatic styles

class StyleRegistry {
  private readonly cellStyles = new Map<string, string>();
  private readonly colStyles = new Map<string, string>();
  private readonly rowStyles = new Map<string, string>();
  readonly xml: string[] = [];

  cell(style: CellStyle | undefined, address: string): string | null {
    if (!style) return null;
    const { validation: _v, ...visual } = style;
    const key = JSON.stringify({ ...visual, base: visual.maps ? address : undefined });
    const known = this.cellStyles.get(key);
    if (known) return known;
    const name = `ce${this.cellStyles.size + 1}`;
    this.cellStyles.set(key, name);
    const cellProps = [
      visual.bg ? `fo:background-color="${visual.bg}"` : "",
      visual.wrap ?? true ? 'fo:wrap-option="wrap"' : "",
      `style:vertical-align="${visual.valign ?? "top"}"`,
      visual.border ? 'fo:border="0.5pt solid #D5DCE6"' : "",
      visual.rotate ? `style:rotation-angle="${visual.rotate}" style:rotation-align="none"` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const textProps = [
      'style:font-name="Calibri"',
      `fo:font-size="${visual.size ?? 10}pt"`,
      visual.bold ? 'fo:font-weight="bold" style:font-weight-complex="bold"' : "",
      visual.color ? `fo:color="${visual.color}"` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const para = visual.align ? `<style:paragraph-properties fo:text-align="${visual.align}"/>` : "";
    const maps = (visual.maps ?? [])
      .map(
        (m) =>
          `<style:map style:condition="cell-content()=&quot;${esc(m.equals)}&quot;" style:apply-style-name="${m.style}" style:base-cell-address="${address}"/>`,
      )
      .join("");
    const data = visual.dataStyle ? ` style:data-style-name="${visual.dataStyle}"` : "";
    this.xml.push(
      `<style:style style:name="${name}" style:family="table-cell" style:parent-style-name="Default"${data}>` +
        `<style:table-cell-properties ${cellProps}/>${para}<style:text-properties ${textProps}/>${maps}</style:style>`,
    );
    return name;
  }

  column(chars: number): string {
    const cm = Math.max(0.05, chars * 0.19).toFixed(3);
    const known = this.colStyles.get(cm);
    if (known) return known;
    const name = `co${this.colStyles.size + 1}`;
    this.colStyles.set(cm, name);
    this.xml.push(
      `<style:style style:name="${name}" style:family="table-column"><style:table-column-properties fo:break-before="auto" style:column-width="${cm}cm"/></style:style>`,
    );
    return name;
  }

  row(pt: number | undefined): string {
    const key = pt === undefined ? "optimal" : String(pt);
    const known = this.rowStyles.get(key);
    if (known) return known;
    const name = `ro${this.rowStyles.size + 1}`;
    this.rowStyles.set(key, name);
    const props =
      pt === undefined
        ? 'style:use-optimal-row-height="true"'
        : `style:row-height="${(pt * 0.03528).toFixed(3)}cm" style:use-optimal-row-height="false"`;
    this.xml.push(
      `<style:style style:name="${name}" style:family="table-row"><style:table-row-properties fo:break-before="auto" ${props}/></style:style>`,
    );
    return name;
  }
}

// ---------------------------------------------------------------------------
// Serialization

function cellXml(sheet: OdsSheet, cell: Cell, row: number, col: number, styles: StyleRegistry): string {
  const address = `${quoteSheet(sheet.name)}.${colName(col)}${row}`;
  const attrs: string[] = [];
  const styleName = styles.cell(cell.style, address);
  if (styleName) attrs.push(`table:style-name="${styleName}"`);
  if (cell.style?.validation) attrs.push(`table:content-validation-name="${cell.style.validation}"`);
  if ((cell.colSpan ?? 1) > 1 || (cell.rowSpan ?? 1) > 1) {
    attrs.push(`table:number-columns-spanned="${cell.colSpan ?? 1}" table:number-rows-spanned="${cell.rowSpan ?? 1}"`);
  }
  if (cell.formula) attrs.push(`table:formula="${esc(cell.formula)}"`);
  const v = cell.value;
  let body = "";
  if (v) {
    switch (v.kind) {
      case "string":
        attrs.push('office:value-type="string" calcext:value-type="string"');
        body = paragraphs(v.text);
        break;
      case "float":
        attrs.push(`office:value-type="float" office:value="${v.value}" calcext:value-type="float"`);
        body = `<text:p>${v.value}</text:p>`;
        break;
      case "date":
        attrs.push(`office:value-type="date" office:date-value="${v.iso}" calcext:value-type="date"`);
        body = `<text:p>${esc(v.text)}</text:p>`;
        break;
      case "boolean":
        attrs.push(`office:value-type="boolean" office:boolean-value="${v.value}" calcext:value-type="boolean"`);
        body = `<text:p>${v.value ? "WAHR" : "FALSCH"}</text:p>`;
        break;
    }
  }
  return `<table:table-cell ${attrs.join(" ")}>${body}</table:table-cell>`.replace("<table:table-cell >", "<table:table-cell>");
}

function tableXml(sheet: OdsSheet, styles: StyleRegistry, tableStyle: string): string {
  const maxRow = Math.max(1, sheet.maxRow);
  const maxCol = Math.max(1, sheet.maxCol);
  // Positions covered by a merge.
  const covered = new Set<string>();
  for (const [k, c] of sheet.cells) {
    const [r, col] = k.split(":").map(Number) as [number, number];
    for (let dr = 0; dr < (c.rowSpan ?? 1); dr++) {
      for (let dc = 0; dc < (c.colSpan ?? 1); dc++) if (dr || dc) covered.add(`${r + dr}:${col + dc}`);
    }
  }

  const parts: string[] = [`<table:table table:name="${esc(sheet.name)}" table:style-name="${tableStyle}">`];
  if (sheet.shapes.length) {
    parts.push("<table:shapes>");
    for (const s of sheet.shapes) {
      parts.push(
        `<draw:frame draw:z-index="0" svg:width="${s.width}" svg:height="${s.height}" svg:x="${s.x}" svg:y="${s.y}">` +
          `<draw:image xlink:href="${s.href}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"><text:p/></draw:image></draw:frame>`,
      );
    }
    parts.push("</table:shapes>");
  }
  for (let col = 1; col <= maxCol; col++) {
    const w = sheet.colWidths.get(col) ?? 10;
    parts.push(`<table:table-column table:style-name="${styles.column(w)}" table:default-cell-style-name="Default"/>`);
  }
  for (let row = 1; row <= maxRow; row++) {
    parts.push(`<table:table-row table:style-name="${styles.row(sheet.rowHeights.get(row))}">`);
    let empty = 0;
    const flush = () => {
      if (empty) parts.push(empty === 1 ? "<table:table-cell/>" : `<table:table-cell table:number-columns-repeated="${empty}"/>`);
      empty = 0;
    };
    for (let col = 1; col <= maxCol; col++) {
      const key = `${row}:${col}`;
      if (covered.has(key)) {
        flush();
        const c = sheet.cells.get(key);
        const styleName = c?.style ? styles.cell(c.style, `${quoteSheet(sheet.name)}.${colName(col)}${row}`) : null;
        parts.push(styleName ? `<table:covered-table-cell table:style-name="${styleName}"/>` : "<table:covered-table-cell/>");
        continue;
      }
      const c = sheet.cells.get(key);
      if (!c || (!c.value && !c.formula && !c.style && !c.colSpan)) {
        empty++;
        continue;
      }
      flush();
      parts.push(cellXml(sheet, c, row, col, styles));
    }
    flush();
    parts.push("</table:table-row>");
  }
  parts.push("</table:table>");
  return parts.join("");
}

function validationsXml(validations: Validation[]): string {
  if (!validations.length) return "";
  const items = validations.map((v) => {
    const list = v.list.map((x) => `&quot;${esc(x)}&quot;`).join(";");
    return (
      `<table:content-validation table:name="${v.name}" table:condition="of:cell-content-is-in-list(${list})" ` +
      `table:allow-empty-cell="true" table:display-list="unsorted" table:base-cell-address="Anwendung.A1">` +
      `<table:error-message table:display="true" table:message-type="stop"/></table:content-validation>`
    );
  });
  return `<table:content-validations>${items.join("")}</table:content-validations>`;
}

function filtersXml(sheets: OdsSheet[]): string {
  const ranges = sheets.filter((s) => s.filterRange);
  if (!ranges.length) return "";
  const items = ranges.map((s, i) => {
    const [a, b] = s.filterRange!.split(":");
    const q = quoteSheet(s.name);
    return `<table:database-range table:name="__Anonymous_Sheet_DB__${i}" table:target-range-address="${esc(`${q}.${a}:${q}.${b}`)}" table:display-filter-buttons="true"/>`;
  });
  return `<table:database-ranges>${items.join("")}</table:database-ranges>`;
}

function contentXml(sheets: OdsSheet[], validations: Validation[]): string {
  const styles = new StyleRegistry();
  const tables = sheets.map((s) => tableXml(s, styles, s.hidden ? "ta_hidden" : s.landscape ? "ta_landscape" : "ta_portrait"));
  const dataStyles =
    '<number:date-style style:name="N_DATE"><number:day number:style="long"/><number:text>.</number:text><number:month number:style="long"/><number:text>.</number:text><number:year number:style="long"/></number:date-style>' +
    '<number:date-style style:name="N_DATETIME"><number:day number:style="long"/><number:text>.</number:text><number:month number:style="long"/><number:text>.</number:text><number:year number:style="long"/><number:text> </number:text><number:hours number:style="long"/><number:text>:</number:text><number:minutes number:style="long"/></number:date-style>';
  const tableStyles =
    '<style:style style:name="ta_portrait" style:family="table" style:master-page-name="Portrait"><style:table-properties table:display="true" style:writing-mode="lr-tb"/></style:style>' +
    '<style:style style:name="ta_landscape" style:family="table" style:master-page-name="Landscape"><style:table-properties table:display="true" style:writing-mode="lr-tb"/></style:style>' +
    '<style:style style:name="ta_hidden" style:family="table" style:master-page-name="Portrait"><style:table-properties table:display="false" style:writing-mode="lr-tb"/></style:style>';
  return (
    `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${NS}>` +
    '<office:font-face-decls><style:font-face style:name="Calibri" svg:font-family="Calibri, Carlito, sans-serif" style:font-family-generic="swiss"/></office:font-face-decls>' +
    `<office:automatic-styles>${dataStyles}${tableStyles}${styles.xml.join("")}</office:automatic-styles>` +
    `<office:body><office:spreadsheet>${validationsXml(validations)}${tables.join("")}${filtersXml(sheets)}</office:spreadsheet></office:body></office:document-content>`
  );
}

function stylesXml(named: NamedStyle[]): string {
  const namedXml = named
    .map(
      (n) =>
        `<style:style style:name="${n.name}" style:family="table-cell" style:parent-style-name="Default">` +
        (n.bg ? `<style:table-cell-properties fo:background-color="${n.bg}"/>` : "") +
        `<style:text-properties fo:color="${n.color}"${n.bold ? ' fo:font-weight="bold"' : ""}/></style:style>`,
    )
    .join("");
  const layout = (name: string, landscape: boolean) =>
    `<style:page-layout style:name="${name}"><style:page-layout-properties fo:page-width="${landscape ? "29.7" : "21"}cm" fo:page-height="${
      landscape ? "21" : "29.7"
    }cm" style:print-orientation="${landscape ? "landscape" : "portrait"}" fo:margin-top="1.5cm" fo:margin-bottom="1.5cm" fo:margin-left="1.5cm" fo:margin-right="1.5cm" style:scale-to-X="1" style:scale-to-Y="0"/></style:page-layout>`;
  return (
    `<?xml version="1.0" encoding="UTF-8"?><office:document-styles ${NS}>` +
    '<office:font-face-decls><style:font-face style:name="Calibri" svg:font-family="Calibri, Carlito, sans-serif" style:font-family-generic="swiss"/></office:font-face-decls>' +
    '<office:styles><style:default-style style:family="table-cell"><style:text-properties style:font-name="Calibri" fo:font-size="10pt" fo:language="de" fo:country="DE"/></style:default-style>' +
    `<style:style style:name="Default" style:family="table-cell"/>${namedXml}</office:styles>` +
    `<office:automatic-styles>${layout("PL_Portrait", false)}${layout("PL_Landscape", true)}</office:automatic-styles>` +
    '<office:master-styles><style:master-page style:name="Portrait" style:page-layout-name="PL_Portrait"/><style:master-page style:name="Landscape" style:page-layout-name="PL_Landscape"/></office:master-styles>' +
    "</office:document-styles>"
  );
}

function metaXml(title: string, creator: string, created: string, modified: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?><office:document-meta ${NS}><office:meta>` +
    `<meta:generator>KOPEXA Schutzbedarfsanalyse</meta:generator><dc:title>${esc(title)}</dc:title>` +
    `<meta:initial-creator>${esc(creator)}</meta:initial-creator><dc:creator>${esc(creator)}</dc:creator>` +
    `<meta:creation-date>${created}</meta:creation-date><dc:date>${modified}</dc:date>` +
    "</office:meta></office:document-meta>"
  );
}

export interface PackageInput {
  sheets: OdsSheet[];
  validations: Validation[];
  namedStyles: NamedStyle[];
  pictures: { path: string; data: Uint8Array; mime: string }[];
  meta: { title: string; creator: string; created: string; modified: string };
}

/** Builds the .ods zip: uncompressed "mimetype" first, then manifest, content, styles and meta. */
export function buildPackage(input: PackageInput): Uint8Array {
  const manifest =
    '<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">' +
    `<manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="${ODS_MIME}"/>` +
    '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>' +
    '<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>' +
    '<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>' +
    input.pictures.map((p) => `<manifest:file-entry manifest:full-path="${p.path}" manifest:media-type="${p.mime}"/>`).join("") +
    "</manifest:manifest>";

  const files: Zippable = {
    mimetype: [strToU8(ODS_MIME), { level: 0 }],
    "META-INF/manifest.xml": strToU8(manifest),
    "content.xml": strToU8(contentXml(input.sheets, input.validations)),
    "styles.xml": strToU8(stylesXml(input.namedStyles)),
    "meta.xml": strToU8(metaXml(input.meta.title, input.meta.creator, input.meta.created, input.meta.modified)),
  };
  for (const p of input.pictures) files[p.path] = [p.data, { level: 0 }];
  return zipSync(files);
}
