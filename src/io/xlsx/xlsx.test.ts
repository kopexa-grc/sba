/// <reference types="node" />
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { CATALOG } from "../../domain/catalog";
import { goalResult } from "../../domain/scoring";
import { GOALS, LEVEL_LABEL, type AssessmentVersion, type AuditEntry, type Goal } from "../../domain/types";
import { approve, newVersion, submitForReview } from "../../domain/versioning";
import { exportVersionXlsx, xlsxFileName } from "./export";
import { parseLegacyXlsx, readScenarioAt, XlsxImportError } from "./import";

const fixture = () => new Uint8Array(readFileSync(new URL("../../../test/fixtures/FS_Schutzbedarfsanalyse_neu.xlsx", import.meta.url)));

function completeVersion(): AssessmentVersion {
  const v = newVersion("asset-1", "Alice <alice@example.com>", {
    name: "Kunden-CRM",
    type: "process",
    owner: "Vertrieb",
    orgUnit: "Sales Operations",
    contact: "crm@example.com",
    assessor: "Alice",
    description: "CRM für Bestands- und Neukunden",
    scope: "Alle Standorte DACH",
    location: "Rechenzentrum Frankfurt",
    personalData: true,
    specialCategoryData: false,
  });
  for (const g of GOALS) {
    for (const s of CATALOG[g].scenarios) v.answers[g][s.id] = { applies: false, level: null, notes: "", explanation: "" };
  }
  v.answers.C.privacy = { applies: true, level: 2, notes: "Kundendaten", explanation: "Finanzdaten der Kunden" };
  v.answers.C.legal = { applies: true, level: 1, notes: "", explanation: "" };
  v.answers.I.safety = { applies: true, level: 2, notes: "", explanation: "Falsche Dosierungsdaten möglich" };
  v.answers.A.safety = { applies: true, level: 3, notes: "Leitstelle", explanation: "Ausfall gefährdet Leben" };
  v.answers.A.operations = { applies: true, level: 3, notes: "", explanation: "RTO < 1 h" };
  v.overrides.I = { level: 3, kind: "inheritance", reason: "Erbt von Leitstellen-Anwendung" };
  v.justifications = { C: "Finanzdaten", I: "Vererbung", A: "Leitstelle" };
  return v;
}

const audit: AuditEntry[] = [
  {
    id: "a1",
    assetId: "asset-1",
    versionId: "v1",
    versionLabel: "1.0-dev",
    at: "2026-09-01T10:00:00.000Z",
    actor: "Alice",
    action: "update",
    field: "Vertraulichkeit · Gesetze & Verträge",
    oldValue: "Normal",
    newValue: "Sehr hoch",
    reason: "Art. 9 DSGVO",
  },
];

describe("legacy import", () => {
  it("reads the original workbook", async () => {
    const r = await parseLegacyXlsx(fixture());
    expect(r.answers.C.legal).toMatchObject({ applies: true, level: 3 });
    expect(Object.keys(r.answers.I)).toEqual([]);
    expect(r.meta.name).toBeUndefined();
    expect(r.versionLabel).toBeUndefined();
    expect(r.rows.every((d) => d.confidence === "exact")).toBe(true);
    expect(r.rows).toHaveLength(17);
    expect(r.issues.filter((i) => i.severity === "conflict")).toEqual([]);
    expect(r.candidateRows.some((c) => c.row === 3)).toBe(true);
  });

  it("finds questions in shifted rows", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(fixture() as unknown as ArrayBuffer);
    wb.getWorksheet("Anwendung")!.spliceRows(16, 0, []);
    const shifted = new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    const r = await parseLegacyXlsx(shifted);
    const byKey = Object.fromEntries(r.rows.map((d) => [`${d.goal}.${d.scenario}`, d]));
    expect(byKey["C.legal"]).toMatchObject({ row: 3, confidence: "exact" });
    expect(byKey["C.operations"]).toMatchObject({ row: 18, confidence: "shifted" });
    expect(byKey["I.legal"]).toMatchObject({ row: 40, confidence: "shifted" });
    expect(byKey["A.financial"]).toMatchObject({ row: 104, confidence: "shifted" });
    expect(r.answers.C.legal).toMatchObject({ applies: true, level: 3 });
  });

  it("reports contradictory answers as conflicts", async () => {
    const r = await parseLegacyXlsx(fixture());
    const snap = structuredClone(r.snapshot);
    snap[5] = { B: null, D: "x", E: "Ja", F: null, H: null };
    const def = CATALOG.C.scenarios[0]!;
    const read = readScenarioAt(snap, "C", def, 3);
    expect(read.answer.level).toBeNull();
    expect(read.issues[0]?.severity).toBe("conflict");
  });

  it("rejects files that are not assessments", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Tabelle1");
    const data = new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    await expect(parseLegacyXlsx(data)).rejects.toThrow(XlsxImportError);
    await expect(parseLegacyXlsx(new Uint8Array([1, 2, 3]))).rejects.toThrow(XlsxImportError);
  });
});

describe("export", () => {
  it("round-trips answers, master data, overrides and justifications", async () => {
    const v = completeVersion();
    const data = await exportVersionXlsx(v, [v], audit);
    const r = await parseLegacyXlsx(data);
    expect(r.answers).toEqual(v.answers);
    expect(r.justifications).toEqual(v.justifications);
    expect(r.overrides).toEqual(v.overrides);
    expect(r.meta).toEqual(v.meta);
    expect(r.versionLabel).toBe("1.0-dev");
    expect(r.statusText).toBe("in Bearbeitung");
    expect(r.rows.every((d) => d.confidence === "exact")).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it("writes the expected sheets with cached formula results", async () => {
    const v = await approve(submitForReview(completeVersion(), "alice"), "ciso");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await exportVersionXlsx(v, [v], audit)) as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Deckblatt", "Anwendung", "Audit-Trail", "Definitionen", "Hilfstabelle"]);
    expect(wb.getWorksheet("Hilfstabelle")!.state).toBe("hidden");

    const app = wb.getWorksheet("Anwendung")!;
    const cover = wb.getWorksheet("Deckblatt")!;
    const summaryRow: Record<Goal, number> = { C: 21, I: 22, A: 23 };
    for (const goal of GOALS) {
      const res = goalResult(v, goal);
      const header = app.getCell(`E${CATALOG[goal].headerRow}`).value as ExcelJS.CellFormulaValue;
      expect(header.formula).toContain("Hilfstabelle!");
      expect(header.result).toBe(LEVEL_LABEL[res.computed!]);
      const summary = cover.getCell(`D${summaryRow[goal]}`).value as ExcelJS.CellFormulaValue;
      expect(summary.result).toBe(LEVEL_LABEL[res.effective!]);
      for (const def of CATALOG[goal].scenarios) {
        const g = app.getCell(`G${def.gateRow}`).value as ExcelJS.CellFormulaValue;
        expect(g.formula).toMatch(/^IF\(/);
      }
    }
    expect((app.getCell("G9").value as ExcelJS.CellFormulaValue).result).toBe("Hoch");
    expect((app.getCell("G88").value as ExcelJS.CellFormulaValue).result).toBe("Sehr hoch");
    expect(cover.getCell("D9").value).toBe("freigegeben");
    expect(cover.getCell("D7").value).toBe("1.0");

    const auditSheet = wb.getWorksheet("Audit-Trail")!;
    expect(auditSheet.getCell("H2").value).toBe("Art. 9 DSGVO");
    expect(auditSheet.getCell("A1").value).toBe("Zeitstempel (UTC)");
  });

  it("builds a readable file name", () => {
    expect(xlsxFileName(completeVersion())).toBe("SBA_Kunden_CRM_v1.0-dev.xlsx");
  });
});
