import ExcelJS from "exceljs";
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
} from "./formulas";
import {
  blockEnd,
  COLOR,
  COVER,
  EXTRA_BLOCK_TITLE,
  EXTRA_LABEL,
  LEGACY_STATUS,
  OVERRIDE_LABEL,
  STATUS_OPTIONS,
  OVERRIDE_ROW,
  SHEET,
} from "./layout";

type Sheet = ExcelJS.Worksheet;

const FONT = "Calibri";

const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  create: "Angelegt",
  update: "Geändert",
  close: "Abgeschlossen",
  branch: "Neue Version",
  import: "Importiert",
  "delete-draft": "Entwurf verworfen",
};

const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin = { style: "thin" as const, color: { argb: COLOR.border } };
const box: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };

function style(cell: ExcelJS.Cell, opts: { bold?: boolean; size?: number; color?: string; bg?: string; wrap?: boolean } = {}) {
  cell.font = { name: FONT, size: opts.size ?? 10, bold: opts.bold ?? false, color: opts.color ? { argb: opts.color } : undefined };
  if (opts.bg) cell.fill = fill(opts.bg);
  cell.alignment = { vertical: "top", wrapText: opts.wrap ?? true };
}

function header(cell: ExcelJS.Cell) {
  style(cell, { bold: true, color: COLOR.white, bg: COLOR.navy, size: 10 });
  cell.alignment = { vertical: "middle", wrapText: true };
}

function setWidths(ws: Sheet, widths: Record<string, number>) {
  for (const [col, w] of Object.entries(widths)) ws.getColumn(col).width = w;
}

function toDate(iso: string | null | undefined): Date | null {
  return iso ? new Date(iso) : null;
}

/** Traffic light rules for cells showing "Normal" / "Hoch" / "Sehr hoch". */
function levelRules(topLeft: string): ExcelJS.ConditionalFormattingRule[] {
  const rule = (formula: string, bg: string, priority: number, fg: string = COLOR.white): ExcelJS.ConditionalFormattingRule => ({
    type: "expression",
    priority,
    formulae: [formula],
    style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: bg } }, font: { color: { argb: fg }, bold: true } },
  });
  return [
    rule(`${topLeft}="Sehr hoch"`, COLOR.veryHigh, 1),
    rule(`${topLeft}="Hoch"`, COLOR.high, 2),
    rule(`${topLeft}="Normal"`, COLOR.normal, 3),
    rule(`OR(ISNUMBER(SEARCH("prüfen",${topLeft})),ISNUMBER(SEARCH("ausfüllen",${topLeft})))`, COLOR.check, 4, "FF374151"),
  ];
}

const LEGACY_COVER_MERGES = [
  "A1:E4", "H3:I4", "A5:C5", "D5:E5", "D6:E6", "A7:C7", "D7:E7", "D8:E8", "A9:C9", "D9:E9", "D10:E10",
  "A11:C11", "D11:E11", "F11:G11", "H11:I11", "A12:C12", "D12:E12", "F12:G12", "H12:I12", "A13:C13",
  "D13:E13", "F13:G13", "H13:I13", "A15:C15", "D15:E15", "A16:C16", "D16:E16", "A18:C18", "D18:E18",
  "A20:E20", "F20:I20", "A21:B23", "D21:E21", "F21:I21", "D22:E22", "F22:I22", "D23:E23", "F23:I23", "D24:H24",
];

function historyMerges(row: number): string[] {
  return [`B${row}:C${row}`, `D${row}:E${row}`, `F${row}:H${row}`];
}

function overrideText(v: AssessmentVersion, goal: Goal): string {
  const o = v.overrides[goal];
  return o ? `\n\n${OVERRIDE_LABEL} auf „${LEVEL_LABEL[o.level]}“ (${OVERRIDE_KIND_LABEL[o.kind]}): ${o.reason}` : "";
}

function buildCover(
  wb: ExcelJS.Workbook,
  v: AssessmentVersion,
  history: AssessmentVersion[],
  catalog: Record<Goal, GoalDef>,
  settings?: Settings,
) {
  const ws = wb.addWorksheet(SHEET.cover, {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ showGridLines: false }],
  });
  setWidths(ws, { A: 5, B: 4, C: 24.7, D: 6, E: 23.3, F: 4, G: 4, H: 30.5, I: 40.7 });
  for (const m of LEGACY_COVER_MERGES) ws.mergeCells(m);

  const title = ws.getCell("A1");
  title.value = "Schutzbedarfsanalyse";
  style(title, { bold: true, size: 18, color: COLOR.white, bg: COLOR.navy });
  title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  const hint = ws.getCell("H3");
  hint.value =
    "Speichern Sie jede Schutzbedarfsanalyse einzeln für jedes schutzbedürftige Asset ab, um die Rückverfolgbarkeit zu gewährleisten. Erstellt mit KOPEXA Schutzbedarfsanalyse (schutzbedarf.kopexa.com).";
  style(hint, { size: 8, color: COLOR.muted });

  const label = (addr: string, text: string) => {
    const c = ws.getCell(addr);
    c.value = text;
    style(c, { bold: true });
  };
  const value = (addr: string, val: ExcelJS.CellValue, fmt?: string) => {
    const c = ws.getCell(addr);
    c.value = val ?? null;
    style(c, { bg: COLOR.navyLight });
    c.border = box;
    if (fmt) c.numFmt = fmt;
  };
  const date = "dd.mm.yyyy hh:mm";

  label("A5", "Schutzbedarfsfeststellung für");
  value(COVER.name, v.meta.name);
  label("A7", "Version:");
  value(COVER.version, versionLabel(v));
  label("A9", "Status:");
  value(COVER.status, LEGACY_STATUS[v.status]);
  ws.getCell(COVER.status).dataValidation = {
    type: "list",
    allowBlank: true,
    formulae: [`"${STATUS_OPTIONS.join(",")}"`],
  };
  label("A11", "zuletzt bearbeitet am:");
  value(COVER.editedAt, toDate(v.updatedAt), date);
  label("F11", "von:");
  value(COVER.editedBy, v.updatedBy);
  label("A12", "fachlich freigegeben am:");
  // Left empty for a manual sign-off on the printout (the app has no approval workflow).
  value(COVER.submittedAt, null, date);
  label("F12", "von:");
  value(COVER.submittedBy, null);
  label("A13", "freigegeben am:");
  value(COVER.approvedAt, null, date);
  label("F13", "von:");
  value(COVER.approvedBy, null);
  label("A15", "Verantwortliche Organisationseinheit:");
  value(COVER.orgUnit, v.meta.orgUnit);
  label("A16", "Kontakt:");
  value(COVER.contact, v.meta.contact);
  label("A18", "personenbezogene Daten:");
  const yn = (b: boolean | null) => (b === null ? "<bitte auswählen>" : b ? "ja" : "nein");
  value(COVER.personalData, yn(v.meta.personalData));
  label("F18", "besondere Art personenbezogener Daten:");
  ws.mergeCells("F18:H18");
  value(COVER.specialCategoryData, yn(v.meta.specialCategoryData));
  for (const addr of [COVER.personalData, COVER.specialCategoryData]) {
    ws.getCell(addr).dataValidation = { type: "list", allowBlank: true, formulae: ['"<bitte auswählen>,ja,nein"'] };
  }

  // Management summary with traffic lights.
  const sumHead = ws.getCell("A20");
  sumHead.value = "Schutzbedarf Zusammenfassung";
  header(sumHead);
  const justHead = ws.getCell("F20");
  justHead.value = "Begründung";
  header(justHead);
  const ampel = ws.getCell("A21");
  ampel.value = "Management Summary";
  style(ampel, { bold: true, color: COLOR.muted, size: 9 });
  ampel.alignment = { vertical: "middle", horizontal: "center", wrapText: true, textRotation: 90 };
  for (const goal of GOALS) {
    const row = COVER.summaryRow[goal];
    const r = goalResult(v, goal);
    label(`C${row}`, GOAL_LABEL[goal]);
    const lvl = ws.getCell(`D${row}`);
    const ovr = `Anwendung!E${OVERRIDE_ROW[goal]}`;
    lvl.value = {
      formula: `IF(${ovr}<>"",${ovr},Anwendung!E${catalog[goal].headerRow})`,
      result: r.override ? LEVEL_LABEL[r.override.level] : legacyGoalResult(v, goal, catalog),
    };
    style(lvl, { bold: true, size: 11 });
    lvl.alignment = { vertical: "middle", horizontal: "center" };
    lvl.border = box;
    const just = ws.getCell(`F${row}`);
    just.value = v.justifications[goal] + overrideText(v, goal);
    style(just, { size: 9 });
    just.border = box;
    ws.getRow(row).height = 48;
  }
  ws.addConditionalFormatting({ ref: "D21:E23", rules: levelRules("D21") });

  // Change history.
  const hRow = COVER.historyHeaderRow;
  const hist = ws.getCell("A25");
  hist.value = "Änderungshistorie";
  style(hist, { bold: true, size: 12, wrap: false });
  const heads: [string, string][] = [
    ["A", "Nr."],
    ["B", "Version"],
    ["D", "Datum"],
    ["F", "Beschreibung der Änderung"],
    ["I", "Bearbeiter"],
  ];
  ws.mergeCells(`B${hRow}:C${hRow}`);
  ws.mergeCells(`D${hRow}:E${hRow}`);
  ws.mergeCells(`F${hRow}:H${hRow}`);
  for (const [col, text] of heads) {
    const c = ws.getCell(`${col}${hRow}`);
    c.value = text;
    header(c);
  }
  const rows = Math.max(COVER.historyMinRows, history.length);
  for (let i = 0; i < rows; i++) {
    const row = COVER.historyFirstRow + i;
    for (const m of historyMerges(row)) ws.mergeCells(m);
    const h = history[i];
    const cells: [string, ExcelJS.CellValue][] = [
      ["A", i + 1],
      ["B", h ? versionLabel(h) : null],
      ["D", h ? toDate(h.closedAt ?? h.updatedAt) : null],
      ["F", h ? h.changeSummary : null],
      ["I", h ? (h.closedBy ?? h.updatedBy) : null],
    ];
    for (const [col, val] of cells) {
      const c = ws.getCell(`${col}${row}`);
      c.value = val;
      style(c, { size: 9 });
      c.border = box;
      if (col === "D") c.numFmt = "dd.mm.yyyy";
    }
  }

  // Additional master data (not part of the legacy sheet).
  let row = COVER.historyFirstRow + rows + 2;
  ws.mergeCells(`A${row}:I${row}`);
  const extra = ws.getCell(`A${row}`);
  extra.value = EXTRA_BLOCK_TITLE;
  header(extra);
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
  ];
  for (const [text, val] of entries) {
    row++;
    ws.mergeCells(`A${row}:C${row}`);
    ws.mergeCells(`D${row}:I${row}`);
    label(`A${row}`, text);
    const c = ws.getCell(`D${row}`);
    c.value = val;
    style(c, { size: 9 });
    c.border = box;
    if (val.length > 90) ws.getRow(row).height = Math.min(120, 13 * Math.ceil(val.length / 90));
  }
}

/** Cached value of Anwendung!E1/E37/E74, computed exactly like the legacy formula. */
function legacyGoalResult(v: AssessmentVersion, goal: Goal, catalog: Record<Goal, GoalDef>): string {
  const sum = catalog[goal].scenarios.reduce(
    (acc, def) => acc + weight(evaluateLevel(def, answerToCells(def, v.answers[goal]?.[def.id]))),
    0,
  );
  return evaluateGoal(goal, sum);
}

function buildAssessment(wb: ExcelJS.Workbook, v: AssessmentVersion, catalog: Record<Goal, GoalDef>) {
  const ws = wb.addWorksheet(SHEET.assessment, {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  setWidths(ws, { A: 0.83, B: 17.66, C: 0.66, D: 63.5, E: 16.33, F: 31.66, G: 14.66, H: 32, I: 0.66 });

  const answerCells: string[] = [];
  for (const goal of GOALS) {
    const gd = catalog[goal];
    const h = gd.headerRow;
    const title = ws.getCell(`B${h}`);
    title.value = gd.title;
    ws.mergeCells(`B${h}:D${h}`);
    header(title);
    title.font = { name: FONT, size: 12, bold: true, color: { argb: COLOR.white } };
    ws.mergeCells(`E${h}:G${h}`);
    const res = ws.getCell(`E${h}`);
    res.value = { formula: goalFormula(goal), result: legacyGoalResult(v, goal, catalog) };
    style(res, { bold: true, size: 12 });
    res.alignment = { vertical: "middle", horizontal: "center" };
    ws.addConditionalFormatting({ ref: `E${h}:G${h}`, rules: levelRules(`E${h}`) });
    ws.getRow(h).height = 20;

    const cols: [string, string][] = [
      ["B", "Schadensszenario"],
      ["D", "Frage"],
      ["E", "Antwort"],
      ["F", "weitere Ausführungen"],
      ["G", "Schutzbedarf"],
      ["H", "Erläuterung Schutzbedarf"],
    ];
    for (const [col, text] of cols) {
      const c = ws.getCell(`${col}${h + 1}`);
      c.value = text;
      style(c, { bold: true, size: 9, bg: COLOR.navyLight });
      c.border = box;
    }

    for (const na of gd.notApplicable) {
      const b = ws.getCell(`B${na.row}`);
      b.value = na.title;
      style(b, { bold: true, size: 9 });
      b.border = box;
      ws.mergeCells(`D${na.row}:H${na.row}`);
      const d = ws.getCell(`D${na.row}`);
      d.value = na.notApplicable;
      style(d, { size: 9, color: COLOR.muted });
      d.border = box;
      ws.getRow(na.row).height = 26;
    }

    for (const def of gd.scenarios) {
      const answer = v.answers[goal]?.[def.id];
      const cells = answerToCells(def, answer);
      const end = blockEnd(def);
      const g = def.gateRow;

      ws.mergeCells(`B${g}:B${end}`);
      const b = ws.getCell(`B${g}`);
      b.value = def.title;
      style(b, { bold: true, size: 9 });
      b.border = box;

      const q = ws.getCell(`D${g}`);
      q.value = def.gate;
      style(q, { size: 9, bold: true });
      const f = ws.getCell(`D${def.followUpRow}`);
      f.value = def.followUp.replace(/ …$/, "");
      style(f, { size: 9, color: COLOR.muted });

      const answerRows = def.kind === "binary" ? [g, def.followUpRow] : [g, ...def.options.map((o) => o.row)];
      const values = [cells.gate, ...cells.options];
      answerRows.forEach((row, i) => {
        const e = ws.getCell(`E${row}`);
        e.value = values[i] ?? null;
        style(e, { size: 9 });
        e.alignment = { vertical: "top", horizontal: "center" };
        e.border = box;
        e.dataValidation = { type: "list", allowBlank: true, formulae: ['"Ja,Nein"'] };
        answerCells.push(`E${row}`);
      });
      if (def.kind === "tiered") {
        for (const o of def.options) {
          const d = ws.getCell(`D${o.row}`);
          d.value = `${o.text}?`;
          style(d, { size: 9 });
        }
      }
      for (let row = g; row <= end; row++) ws.getCell(`D${row}`).border = box;

      ws.mergeCells(`F${g}:F${end}`);
      const notes = ws.getCell(`F${g}`);
      notes.value = answer?.notes || null;
      style(notes, { size: 9 });
      notes.border = box;

      ws.mergeCells(`G${g}:G${end}`);
      const lvl = ws.getCell(`G${g}`);
      lvl.value = { formula: levelFormula(def), result: evaluateLevel(def, cells) };
      style(lvl, { bold: true, size: 10 });
      lvl.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      lvl.border = box;
      ws.addConditionalFormatting({ ref: `G${g}:G${end}`, rules: levelRules(`G${g}`) });

      ws.mergeCells(`H${g}:H${end}`);
      const expl = ws.getCell(`H${g}`);
      expl.value = answer?.explanation || null;
      style(expl, { size: 9 });
      expl.border = box;
    }

    // Manual override below the block (outside the legacy coordinates).
    const o = v.overrides[goal];
    const r = OVERRIDE_ROW[goal];
    const ol = ws.getCell(`B${r}`);
    ol.value = OVERRIDE_LABEL;
    style(ol, { bold: true, size: 9 });
    const reason = ws.getCell(`D${r}`);
    reason.value = o ? o.reason : "keine";
    style(reason, { size: 9, color: o ? undefined : COLOR.muted });
    const ov = ws.getCell(`E${r}`);
    ov.value = o ? LEVEL_LABEL[o.level] : null;
    style(ov, { bold: true, size: 9 });
    ov.alignment = { horizontal: "center", vertical: "top" };
    ws.addConditionalFormatting({ ref: `E${r}`, rules: levelRules(`E${r}`) });
    const kind = ws.getCell(`F${r}`);
    kind.value = o ? OVERRIDE_KIND_LABEL[o.kind] : null;
    style(kind, { size: 9 });
    for (const col of ["B", "D", "E", "F"]) ws.getCell(`${col}${r}`).border = box;
  }

  // Grey out answers that were answered with "Nein" (as in the legacy sheet).
  ws.addConditionalFormatting({
    ref: answerCells.join(" "),
    rules: [
      {
        type: "expression",
        priority: 10,
        formulae: [`${answerCells[0]}="Nein"`],
        style: { font: { color: { argb: COLOR.muted } } },
      },
    ],
  });
  ws.views = [{ showGridLines: false }];
}

function buildAudit(wb: ExcelJS.Workbook, audit: AuditEntry[]) {
  const ws = wb.addWorksheet(SHEET.audit, {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = [
    { header: "Zeitstempel (UTC)", key: "at", width: 22 },
    { header: "Version", key: "version", width: 10 },
    { header: "Akteur", key: "actor", width: 28 },
    { header: "Aktion", key: "action", width: 22 },
    { header: "Feld / Kriterium", key: "field", width: 38 },
    { header: "Alter Wert", key: "old", width: 28 },
    { header: "Neuer Wert", key: "new", width: 28 },
    { header: "Änderungsgrund", key: "reason", width: 44 },
  ];
  ws.getRow(1).eachCell((c) => header(c));
  const sorted = [...audit].sort((a, b) => a.at.localeCompare(b.at));
  for (const e of sorted) {
    const row = ws.addRow({
      at: e.at,
      version: e.versionLabel,
      actor: e.actor,
      action: AUDIT_ACTION_LABEL[e.action],
      field: e.field ?? "",
      old: e.oldValue ?? "",
      new: e.newValue ?? "",
      reason: e.reason ?? "",
    });
    row.eachCell({ includeEmpty: true }, (c) => {
      style(c, { size: 9 });
      c.border = box;
    });
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sorted.length + 1), column: 8 } };
}

function buildDefinitions(wb: ExcelJS.Workbook, v: AssessmentVersion) {
  const DEFINITIONS = definitionsFor(v.scheme);
  const ws = wb.addWorksheet(SHEET.definitions, {
    views: [{ state: "frozen", xSplit: 1, ySplit: 2 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.getColumn(1).width = 22;
  for (let c = 2; c <= 10; c++) ws.getColumn(c).width = 34;
  const cats: [string, string, number][] = [
    ["Schutzbedarfskategorie „normal“", COLOR.normal, 2],
    ["Schutzbedarfskategorie „hoch“", COLOR.high, 5],
    ["Schutzbedarfskategorie „sehr hoch“", COLOR.veryHigh, 8],
  ];
  ws.mergeCells("A1:A2");
  const s = ws.getCell("A1");
  s.value = "Szenario";
  header(s);
  for (const [text, color, col] of cats) {
    ws.mergeCells(1, col, 1, col + 2);
    const c = ws.getCell(1, col);
    c.value = text;
    style(c, { bold: true, color: COLOR.white, bg: color });
    GOALS.forEach((goal, i) => {
      const g = ws.getCell(2, col + i);
      g.value = GOAL_LABEL[goal];
      header(g);
    });
  }
  DEFINITIONS.forEach((d, i) => {
    const row = 3 + i;
    const t = ws.getCell(row, 1);
    t.value = SCENARIO_TITLE[d.scenario];
    style(t, { bold: true, size: 9 });
    t.border = box;
    const groups = [d.normal, d.high, d.veryHigh];
    groups.forEach((group, gi) => {
      GOALS.forEach((goal, i2) => {
        const c = ws.getCell(row, 2 + gi * 3 + i2);
        c.value = group[goal];
        style(c, { size: 9 });
        c.border = box;
      });
    });
    ws.getRow(row).height = 150;
  });
  const note = ws.getCell(3 + DEFINITIONS.length + 1, 1);
  note.value =
    "Maximumprinzip: Der Schutzbedarf eines Grundwerts entspricht der höchsten Einstufung aller Schadensszenarien. Kumulations-, Verteilungs- und Vererbungseffekte werden als manuelle Übersteuerung mit Begründung dokumentiert.";
  ws.mergeCells(3 + DEFINITIONS.length + 1, 1, 3 + DEFINITIONS.length + 1, 10);
  style(note, { size: 9, color: COLOR.muted });
}

function buildHelper(wb: ExcelJS.Workbook, v: AssessmentVersion, catalog: Record<Goal, GoalDef>) {
  const ws = wb.addWorksheet(SHEET.helper, { state: "hidden" });
  for (const goal of GOALS) {
    const [lc, vc] = HELPER_COLUMNS[goal];
    ws.getCell(`${lc}1`).value = `Grundwert: ${GOAL_LABEL[goal]}`;
    ws.getCell(`${lc}3`).value = "Spalte";
    ws.getCell(`${vc}3`).value = "Wert";
    let sum = 0;
    catalog[goal].scenarios.forEach((def, i) => {
      const row = HELPER_FIRST_ROW + i;
      const w = weight(evaluateLevel(def, answerToCells(def, v.answers[goal]?.[def.id])));
      sum += w;
      ws.getCell(`${lc}${row}`).value = `G${def.gateRow}`;
      ws.getCell(`${vc}${row}`).value = { formula: helperCellFormula(goal, i), result: w };
    });
    const last = HELPER_FIRST_ROW + catalog[goal].scenarios.length - 1;
    ws.getCell(`${lc}${HELPER_SUM_ROW}`).value = "Summe";
    ws.getCell(`${vc}${HELPER_SUM_ROW}`).value = { formula: `SUM(${vc}${HELPER_FIRST_ROW}:${vc}${last})`, result: sum };
  }
}

/** Places the organization logo top right on the cover sheet (PNG/JPEG data URLs only). */
function addLogo(wb: ExcelJS.Workbook, settings?: Settings) {
  const logo = settings?.organization.logo;
  const m = logo?.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
  if (!m) return;
  const extension = m[1]!.toLowerCase() === "png" ? "png" : "jpeg";
  const id = wb.addImage({ base64: m[2]!, extension });
  const ws = wb.getWorksheet(SHEET.cover);
  // Top right in rows 1-2 of column I, above the hint text in H3:I4 (square logos).
  ws?.addImage(id, { tl: { col: 8.82, row: 0.1 }, ext: { width: 30, height: 30 } });
}

/**
 * Builds the audit report workbook for one version: cover sheet, questionnaire
 * in the legacy layout (with formulas), audit trail, definitions and the
 * hidden helper table.
 */
export async function exportVersionXlsx(
  version: AssessmentVersion,
  history: AssessmentVersion[],
  audit: AuditEntry[],
  settings?: Settings,
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "KOPEXA Schutzbedarfsanalyse";
  wb.lastModifiedBy = version.updatedBy;
  wb.created = new Date(version.createdAt);
  wb.modified = new Date(version.updatedAt);
  wb.title = `Schutzbedarfsanalyse ${version.meta.name} ${versionLabel(version)}`;
  wb.calcProperties.fullCalcOnLoad = true;

  const catalog = catalogFor(version.scheme);
  buildCover(wb, version, history, catalog, settings);
  addLogo(wb, settings);
  buildAssessment(wb, version, catalog);
  buildAudit(wb, audit);
  buildDefinitions(wb, version);
  buildHelper(wb, version, catalog);

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

/** Suggested download file name. */
export function xlsxFileName(version: AssessmentVersion): string {
  const name = version.meta.name.trim().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "") || "Asset";
  return `SBA_${name}_v${versionLabel(version)}.xlsx`;
}
