import { SCENARIO_TITLE, type GoalDef } from "../../domain/catalog";
import { catalogFor, definitionsFor, describeScheme, type Settings } from "../../domain/scheme";
import { goalResult } from "../../domain/scoring";
import {
  ASSET_TYPE_LABEL,
  GOALS,
  GOAL_LABEL,
  LEVEL_LABEL,
  OVERRIDE_KIND_LABEL,
  type AssessmentVersion,
  type AuditAction,
  type AuditEntry,
  type Goal,
} from "../../domain/types";
import { versionLabel } from "../../domain/versioning";
import {
  answerToCells,
  evaluateGoal,
  evaluateLevel,
  goalFormula,
  helperCellFormula,
  HELPER_COLUMNS,
  HELPER_FIRST_ROW,
  HELPER_SUM_ROW,
  levelFormula,
  weight,
} from "../xlsx/formulas";
import {
  blockEnd,
  COVER,
  EXTRA_BLOCK_TITLE,
  EXTRA_LABEL,
  LEGACY_STATUS,
  OVERRIDE_LABEL,
  OVERRIDE_ROW,
  SHEET,
  STATUS_OPTIONS,
} from "../xlsx/layout";
import { colName, OdsSheet, type CellStyle, type Validation } from "./model";
import { buildPackage, type NamedStyle } from "./package";

const NAVY = "#10263e";
const NAVY_LIGHT = "#eef3fb";
const MUTED = "#5b6778";
const WHITE = "#ffffff";

/** Conditional styles for cells that show a protection level (restrained tints, dark text). */
const NAMED_STYLES: NamedStyle[] = [
  { name: "Lvl_Normal", bg: "#d1fae5", color: "#065f46", bold: true },
  { name: "Lvl_Hoch", bg: "#fef3c7", color: "#92400e", bold: true },
  { name: "Lvl_SehrHoch", bg: "#fee2e2", color: "#991b1b", bold: true },
  { name: "Lvl_Pruefen", bg: "#e5e7eb", color: "#374151" },
  { name: "Ans_Nein", color: MUTED },
];

const LEVEL_MAPS: CellStyle["maps"] = [
  { equals: "Sehr hoch", style: "Lvl_SehrHoch" },
  { equals: "Hoch", style: "Lvl_Hoch" },
  { equals: "Normal", style: "Lvl_Normal" },
  { equals: "Eingabe prüfen!", style: "Lvl_Pruefen" },
  { equals: "Bitte Spalte E ausfüllen", style: "Lvl_Pruefen" },
];

const VALIDATIONS: Validation[] = [
  { name: "val_janein", list: ["Ja", "Nein"] },
  { name: "val_status", list: STATUS_OPTIONS },
  { name: "val_janein_klein", list: ["<bitte auswählen>", "ja", "nein"] },
];

const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  create: "Angelegt",
  update: "Geändert",
  close: "Abgeschlossen",
  branch: "Neue Version",
  import: "Importiert",
  "delete-draft": "Entwurf verworfen",
};

const HEADER: CellStyle = { bold: true, color: WHITE, bg: NAVY, valign: "middle" };
const LABEL: CellStyle = { bold: true };
const VALUE: CellStyle = { bg: NAVY_LIGHT, border: true };
const SMALL: CellStyle = { size: 9, border: true };

const LEGACY_COVER_MERGES = [
  "A1:E4", "H3:I4", "A5:C5", "D5:E5", "D6:E6", "A7:C7", "D7:E7", "D8:E8", "A9:C9", "D9:E9", "D10:E10",
  "A11:C11", "D11:E11", "F11:G11", "H11:I11", "A12:C12", "D12:E12", "F12:G12", "H12:I12", "A13:C13",
  "D13:E13", "F13:G13", "H13:I13", "A15:C15", "D15:E15", "A16:C16", "D16:E16", "A18:C18", "D18:E18",
  "A20:E20", "F20:I20", "A21:B23", "D21:E21", "F21:I21", "D22:E22", "F22:I22", "D23:E23", "F23:I23", "D24:H24",
];

function overrideText(v: AssessmentVersion, goal: Goal): string {
  const o = v.overrides[goal];
  return o ? `\n\n${OVERRIDE_LABEL} auf „${LEVEL_LABEL[o.level]}“ (${OVERRIDE_KIND_LABEL[o.kind]}): ${o.reason}` : "";
}

/** Cached value of Anwendung!E1/E37/E74, computed exactly like the legacy formula. */
function legacyGoalResult(v: AssessmentVersion, goal: Goal, catalog: Record<Goal, GoalDef>): string {
  const sum = catalog[goal].scenarios.reduce(
    (acc, def) => acc + weight(evaluateLevel(def, answerToCells(def, v.answers[goal]?.[def.id]))),
    0,
  );
  return evaluateGoal(goal, sum);
}

function buildCover(v: AssessmentVersion, history: AssessmentVersion[], catalog: Record<Goal, GoalDef>, settings?: Settings) {
  const ws = new OdsSheet(SHEET.cover);
  for (const [col, w] of Object.entries({ A: 5, B: 4, C: 24.7, D: 6, E: 23.3, F: 4, G: 4, H: 30.5, I: 40.7 })) ws.width(col, w);
  for (const m of LEGACY_COVER_MERGES) ws.merge(m);

  ws.set("A1", "Schutzbedarfsanalyse", { ...HEADER, size: 18 });
  ws.set(
    "H3",
    "Speichern Sie jede Schutzbedarfsanalyse einzeln für jedes schutzbedürftige Asset ab, um die Rückverfolgbarkeit zu gewährleisten. Erstellt mit KOPEXA Schutzbedarfsanalyse (schutzbedarf.kopexa.com).",
    { size: 8, color: MUTED },
  );

  const label = (addr: string, text: string) => ws.set(addr, text, LABEL);
  const value = (addr: string, val: string | number | null, extra?: CellStyle) => ws.set(addr, val, { ...VALUE, ...extra });

  label("A5", "Schutzbedarfsfeststellung für");
  value(COVER.name, v.meta.name);
  label("A7", "Version:");
  value(COVER.version, versionLabel(v));
  label("A9", "Status:");
  value(COVER.status, LEGACY_STATUS[v.status], { validation: "val_status" });
  label("A11", "zuletzt bearbeitet am:");
  ws.setDate(COVER.editedAt, v.updatedAt, true, VALUE);
  label("F11", "von:");
  value(COVER.editedBy, v.updatedBy);
  // Left empty for a manual sign-off on the printout (the app has no approval workflow).
  label("A12", "fachlich freigegeben am:");
  ws.setDate(COVER.submittedAt, null, true, VALUE);
  label("F12", "von:");
  value(COVER.submittedBy, null);
  label("A13", "freigegeben am:");
  ws.setDate(COVER.approvedAt, null, true, VALUE);
  label("F13", "von:");
  value(COVER.approvedBy, null);
  label("A15", "Verantwortliche Organisationseinheit:");
  value(COVER.orgUnit, v.meta.orgUnit);
  label("A16", "Kontakt:");
  value(COVER.contact, v.meta.contact);
  label("A18", "personenbezogene Daten:");
  const yn = (b: boolean | null) => (b === null ? "<bitte auswählen>" : b ? "ja" : "nein");
  value(COVER.personalData, yn(v.meta.personalData), { validation: "val_janein_klein" });
  label("F18", "besondere Art personenbezogener Daten:");
  ws.merge("F18:H18");
  value(COVER.specialCategoryData, yn(v.meta.specialCategoryData), { validation: "val_janein_klein" });

  ws.set("A20", "Schutzbedarf Zusammenfassung", HEADER);
  ws.set("F20", "Begründung", HEADER);
  ws.set("A21", "Management Summary", { bold: true, size: 9, color: MUTED, align: "center", valign: "middle", rotate: 90 });
  for (const goal of GOALS) {
    const row = COVER.summaryRow[goal];
    const r = goalResult(v, goal);
    label(`C${row}`, GOAL_LABEL[goal]);
    const ovr = `Anwendung!E${OVERRIDE_ROW[goal]}`;
    ws.setFormula(
      `D${row}`,
      `IF(${ovr}<>"",${ovr},Anwendung!E${catalog[goal].headerRow})`,
      r.override ? LEVEL_LABEL[r.override.level] : legacyGoalResult(v, goal, catalog),
      { bold: true, size: 11, align: "center", valign: "middle", border: true, maps: LEVEL_MAPS },
    );
    ws.set(`F${row}`, v.justifications[goal] + overrideText(v, goal), { size: 9, border: true });
    ws.height(row, 48);
  }

  const hRow = COVER.historyHeaderRow;
  ws.set("A25", "Änderungshistorie", { bold: true, size: 12, wrap: false });
  ws.merge(`B${hRow}:C${hRow}`);
  ws.merge(`D${hRow}:E${hRow}`);
  ws.merge(`F${hRow}:H${hRow}`);
  for (const [col, text] of [
    ["A", "Nr."],
    ["B", "Version"],
    ["D", "Datum"],
    ["F", "Beschreibung der Änderung"],
    ["I", "Bearbeiter"],
  ] as const) {
    ws.set(`${col}${hRow}`, text, HEADER);
  }
  const rows = Math.max(COVER.historyMinRows, history.length);
  for (let i = 0; i < rows; i++) {
    const row = COVER.historyFirstRow + i;
    ws.merge(`B${row}:C${row}`);
    ws.merge(`D${row}:E${row}`);
    ws.merge(`F${row}:H${row}`);
    const h = history[i];
    ws.set(`A${row}`, i + 1, SMALL);
    ws.set(`B${row}`, h ? versionLabel(h) : null, SMALL);
    ws.setDate(`D${row}`, h ? (h.closedAt ?? h.updatedAt) : null, false, SMALL);
    ws.set(`F${row}`, h ? h.changeSummary : null, SMALL);
    ws.set(`I${row}`, h ? (h.closedBy ?? h.updatedBy) : null, SMALL);
  }

  let row = COVER.historyFirstRow + rows + 2;
  ws.merge(`A${row}:I${row}`);
  ws.set(`A${row}`, EXTRA_BLOCK_TITLE, HEADER);
  const closed = v.closedAt ? `${new Date(v.closedAt).toISOString()}, ${v.closedBy ?? ""}`.replace(/, $/, "") : "in Bearbeitung";
  const entries: [string, string][] = [
    [EXTRA_LABEL.type, ASSET_TYPE_LABEL[v.meta.type]],
    [EXTRA_LABEL.owner, v.meta.owner],
    [EXTRA_LABEL.assessor, v.meta.assessor],
    [EXTRA_LABEL.description, v.meta.description],
    [EXTRA_LABEL.scope, v.meta.scope],
    [EXTRA_LABEL.location, v.meta.location],
    [EXTRA_LABEL.assetId, v.assetId],
    [EXTRA_LABEL.versionId, v.id],
    [EXTRA_LABEL.closed, closed],
    [EXTRA_LABEL.scheme, describeScheme(v.scheme)],
    [EXTRA_LABEL.organization, settings?.organization.name ?? ""],
    [EXTRA_LABEL.preparedBy, settings?.preparedBy?.name ?? ""],
  ];
  for (const [text, val] of entries) {
    row++;
    ws.merge(`A${row}:C${row}`);
    ws.merge(`D${row}:I${row}`);
    label(`A${row}`, text);
    ws.set(`D${row}`, val, SMALL);
  }
  return ws;
}

function buildAssessment(v: AssessmentVersion, catalog: Record<Goal, GoalDef>) {
  const ws = new OdsSheet(SHEET.assessment);
  ws.landscape = true;
  for (const [col, w] of Object.entries({ A: 0.83, B: 17.66, C: 0.66, D: 63.5, E: 16.33, F: 31.66, G: 14.66, H: 32, I: 0.66 })) {
    ws.width(col, w);
  }
  const answerStyle: CellStyle = { size: 9, align: "center", border: true, validation: "val_janein" };

  for (const goal of GOALS) {
    const gd = catalog[goal];
    const h = gd.headerRow;
    ws.merge(`B${h}:D${h}`);
    ws.set(`B${h}`, gd.title, { ...HEADER, size: 12 });
    ws.merge(`E${h}:G${h}`);
    ws.setFormula(`E${h}`, goalFormula(goal), legacyGoalResult(v, goal, catalog), {
      bold: true,
      size: 12,
      align: "center",
      valign: "middle",
      maps: LEVEL_MAPS,
    });
    ws.height(h, 20);
    for (const [col, text] of [
      ["B", "Schadensszenario"],
      ["D", "Frage"],
      ["E", "Antwort"],
      ["F", "weitere Ausführungen"],
      ["G", "Schutzbedarf"],
      ["H", "Erläuterung Schutzbedarf"],
    ] as const) {
      ws.set(`${col}${h + 1}`, text, { bold: true, size: 9, bg: NAVY_LIGHT, border: true });
    }

    for (const na of gd.notApplicable) {
      ws.set(`B${na.row}`, na.title, { bold: true, size: 9, border: true });
      ws.merge(`D${na.row}:H${na.row}`);
      ws.set(`D${na.row}`, na.notApplicable, { size: 9, color: MUTED, border: true });
    }

    for (const def of gd.scenarios) {
      const answer = v.answers[goal]?.[def.id];
      const cells = answerToCells(def, answer);
      const end = blockEnd(def);
      const g = def.gateRow;

      ws.merge(`B${g}:B${end}`);
      ws.set(`B${g}`, def.title, { bold: true, size: 9, border: true });
      ws.set(`D${g}`, def.gate, { size: 9, bold: true, border: true });
      ws.set(`D${def.followUpRow}`, def.followUp.replace(/ …$/, ""), { size: 9, color: MUTED, border: true });
      if (def.kind === "tiered") for (const o of def.options) ws.set(`D${o.row}`, `${o.text}?`, { size: 9, border: true });

      const answerRows = def.kind === "binary" ? [g, def.followUpRow] : [g, ...def.options.map((o) => o.row)];
      const values = [cells.gate, ...cells.options];
      answerRows.forEach((r, i) => {
        ws.set(`E${r}`, values[i] ?? null, { ...answerStyle, maps: [{ equals: "Nein", style: "Ans_Nein" }] });
      });

      ws.merge(`F${g}:F${end}`);
      ws.set(`F${g}`, answer?.notes || null, { size: 9, border: true });
      ws.merge(`G${g}:G${end}`);
      ws.setFormula(`G${g}`, levelFormula(def), evaluateLevel(def, cells), {
        bold: true,
        align: "center",
        valign: "middle",
        border: true,
        maps: LEVEL_MAPS,
      });
      ws.merge(`H${g}:H${end}`);
      ws.set(`H${g}`, answer?.explanation || null, { size: 9, border: true });
    }

    const o = v.overrides[goal];
    const r = OVERRIDE_ROW[goal];
    ws.set(`B${r}`, OVERRIDE_LABEL, { bold: true, size: 9, border: true });
    ws.set(`D${r}`, o ? o.reason : "keine", { size: 9, border: true, ...(o ? {} : { color: MUTED }) });
    ws.set(`E${r}`, o ? LEVEL_LABEL[o.level] : null, { bold: true, size: 9, align: "center", border: true, maps: LEVEL_MAPS });
    ws.set(`F${r}`, o ? OVERRIDE_KIND_LABEL[o.kind] : null, { size: 9, border: true });
  }
  return ws;
}

function buildAudit(audit: AuditEntry[]) {
  const ws = new OdsSheet(SHEET.audit);
  ws.landscape = true;
  const cols: [string, number][] = [
    ["Zeitstempel (UTC)", 22],
    ["Version", 10],
    ["Akteur", 28],
    ["Aktion", 22],
    ["Feld / Kriterium", 38],
    ["Alter Wert", 28],
    ["Neuer Wert", 28],
    ["Änderungsgrund", 44],
  ];
  cols.forEach(([text, w], i) => {
    ws.width(colName(i + 1), w);
    ws.set(`${colName(i + 1)}1`, text, HEADER);
  });
  const sorted = [...audit].sort((a, b) => a.at.localeCompare(b.at));
  sorted.forEach((e, i) => {
    const row = i + 2;
    const values = [e.at, e.versionLabel, e.actor, AUDIT_ACTION_LABEL[e.action], e.field ?? "", e.oldValue ?? "", e.newValue ?? "", e.reason ?? ""];
    values.forEach((val, c) => ws.set(`${colName(c + 1)}${row}`, val, SMALL));
  });
  ws.filterRange = `A1:H${Math.max(1, sorted.length + 1)}`;
  return ws;
}

function buildDefinitions(v: AssessmentVersion) {
  const defs = definitionsFor(v.scheme);
  const ws = new OdsSheet(SHEET.definitions);
  ws.landscape = true;
  ws.width("A", 22);
  for (let c = 2; c <= 10; c++) ws.width(colName(c), 34);
  ws.merge("A1:A2");
  ws.set("A1", "Szenario", HEADER);
  const cats: [string, string, number][] = [
    ["Schutzbedarfskategorie „normal“", "#10b981", 2],
    ["Schutzbedarfskategorie „hoch“", "#f59e0b", 5],
    ["Schutzbedarfskategorie „sehr hoch“", "#ef4444", 8],
  ];
  for (const [text, color, col] of cats) {
    ws.merge(`${colName(col)}1:${colName(col + 2)}1`);
    ws.set(`${colName(col)}1`, text, { bold: true, color: WHITE, bg: color });
    GOALS.forEach((goal, i) => ws.set(`${colName(col + i)}2`, GOAL_LABEL[goal], HEADER));
  }
  defs.forEach((d, i) => {
    const row = 3 + i;
    ws.set(`A${row}`, SCENARIO_TITLE[d.scenario], { bold: true, size: 9, border: true });
    [d.normal, d.high, d.veryHigh].forEach((group, gi) => {
      GOALS.forEach((goal, i2) => ws.set(`${colName(2 + gi * 3 + i2)}${row}`, group[goal], { size: 9, border: true }));
    });
  });
  const noteRow = 3 + defs.length + 1;
  ws.merge(`A${noteRow}:J${noteRow}`);
  ws.set(
    `A${noteRow}`,
    "Maximumprinzip: Der Schutzbedarf eines Grundwerts entspricht der höchsten Einstufung aller Schadensszenarien. Kumulations-, Verteilungs- und Vererbungseffekte werden als manuelle Übersteuerung mit Begründung dokumentiert.",
    { size: 9, color: MUTED },
  );
  return ws;
}

function buildHelper(v: AssessmentVersion, catalog: Record<Goal, GoalDef>) {
  const ws = new OdsSheet(SHEET.helper);
  ws.hidden = true;
  for (const goal of GOALS) {
    const [lc, vc] = HELPER_COLUMNS[goal];
    ws.set(`${lc}1`, `Grundwert: ${GOAL_LABEL[goal]}`);
    ws.set(`${lc}3`, "Spalte");
    ws.set(`${vc}3`, "Wert");
    let sum = 0;
    catalog[goal].scenarios.forEach((def, i) => {
      const row = HELPER_FIRST_ROW + i;
      const w = weight(evaluateLevel(def, answerToCells(def, v.answers[goal]?.[def.id])));
      sum += w;
      ws.set(`${lc}${row}`, `G${def.gateRow}`);
      ws.setFormula(`${vc}${row}`, helperCellFormula(goal, i), w);
    });
    const last = HELPER_FIRST_ROW + catalog[goal].scenarios.length - 1;
    ws.set(`${lc}${HELPER_SUM_ROW}`, "Summe");
    ws.setFormula(`${vc}${HELPER_SUM_ROW}`, `SUM(${vc}${HELPER_FIRST_ROW}:${vc}${last})`, sum);
  }
  return ws;
}

/** Decodes a PNG/JPEG data URL; returns pixel size for PNG (IHDR), null size otherwise. */
function decodeLogo(dataUrl: string | null | undefined) {
  const m = dataUrl?.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
  if (!m) return null;
  const bin = atob(m[2]!);
  const data = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  const png = m[1]!.toLowerCase() === "png";
  let size: { w: number; h: number } | null = null;
  if (png && data.length > 24) {
    const dv = new DataView(data.buffer);
    size = { w: dv.getUint32(16), h: dv.getUint32(20) };
  }
  return { data, png, size };
}

/**
 * Builds the audit report as OpenDocument spreadsheet (.ods) with the same
 * sheets and cell coordinates as the XLSX export.
 */
export async function exportVersionOds(
  version: AssessmentVersion,
  history: AssessmentVersion[],
  audit: AuditEntry[],
  settings?: Settings,
): Promise<Uint8Array> {
  const catalog = catalogFor(version.scheme);
  const cover = buildCover(version, history, catalog, settings);
  const pictures: { path: string; data: Uint8Array; mime: string }[] = [];
  const logo = decodeLogo(settings?.organization.logo);
  if (logo) {
    const path = `Pictures/logo.${logo.png ? "png" : "jpg"}`;
    pictures.push({ path, data: logo.data, mime: logo.png ? "image/png" : "image/jpeg" });
    // Top right, within rows 1-2 above the hint text; keeps the aspect ratio when known.
    const h = 0.8;
    const w = logo.size ? Math.min(4, (h * logo.size.w) / logo.size.h) : h;
    cover.shapes.push({ href: path, x: `${(26.8 - w).toFixed(2)}cm`, y: "0.15cm", width: `${w.toFixed(2)}cm`, height: `${h}cm` });
  }
  const bytes = buildPackage({
    sheets: [cover, buildAssessment(version, catalog), buildAudit(audit), buildDefinitions(version), buildHelper(version, catalog)],
    validations: VALIDATIONS,
    namedStyles: NAMED_STYLES,
    pictures,
    meta: {
      title: `Schutzbedarfsanalyse ${version.meta.name} ${versionLabel(version)}`,
      creator: version.updatedBy,
      created: new Date(version.createdAt).toISOString().slice(0, 19),
      modified: new Date(version.updatedAt).toISOString().slice(0, 19),
    },
  });
  return bytes;
}

/** Suggested download file name. */
export function odsFileName(version: AssessmentVersion): string {
  const name = version.meta.name.trim().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "") || "Asset";
  return `SBA_${name}_v${versionLabel(version)}.ods`;
}
