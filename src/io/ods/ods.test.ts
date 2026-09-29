/// <reference types="node" />
import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { CATALOG } from "../../domain/catalog";
import { DEFAULT_SNAPSHOT, defaultSettings } from "../../domain/scheme";
import { GOALS, type AssessmentVersion, type AuditEntry } from "../../domain/types";
import { closeVersion, newVersion } from "../../domain/versioning";
import { exportVersionXlsx } from "../xlsx/export";
import { parseLegacyXlsx, XlsxImportError } from "../xlsx/import";
import { exportVersionOds, odsFileName } from "./export";
import { detectSpreadsheetFormat, odsReader, parseLegacyOds, parseLegacySpreadsheet } from "./import";
import { excelToOpenFormula } from "./model";

const fixture = (ext: "xlsx" | "ods") =>
  new Uint8Array(readFileSync(new URL(`../../../test/fixtures/FS_Schutzbedarfsanalyse_neu.${ext}`, import.meta.url)));

function completeVersion(): AssessmentVersion {
  const v = newVersion("asset-1", "Alice <alice@example.com>", {
    name: "Kunden-CRM",
    type: "process",
    owner: "Vertrieb",
    orgUnit: "Sales Operations",
    contact: "crm@example.com",
    assessor: "Alice",
    description: "CRM für Bestands- und Neukunden\nmit Außendienst-App",
    scope: "Alle Standorte  DACH & Österreich <intern>",
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
  v.scheme = {
    ...DEFAULT_SNAPSHOT,
    name: "Mittelstand",
    revision: 3,
    financialHigh: 250_000,
    financialVeryHigh: 2_500_000,
    availabilityHighHours: 8,
    availabilityVeryHighHours: 2,
  };
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

function settingsWithLogo() {
  const settings = defaultSettings();
  settings.organization = {
    name: "Muster GmbH",
    logo: `data:image/png;base64,${readFileSync(new URL("../../../public/pwa-192.png", import.meta.url)).toString("base64")}`,
  };
  return settings;
}

describe("formula conversion", () => {
  it("translates references, sheets and separators", () => {
    expect(excelToOpenFormula('IF(AND(E5="Ja",E6="Ja"),"Eingabe prüfen!",IF(E5="Nein","Normal"))')).toBe(
      'of:=IF(AND([.E5]="Ja";[.E6]="Ja");"Eingabe prüfen!";IF([.E5]="Nein";"Normal"))',
    );
    expect(excelToOpenFormula('IF(Anwendung!E35<>"",Anwendung!E35,Anwendung!E1)')).toBe(
      'of:=IF([$Anwendung.E35]<>"";[$Anwendung.E35];[$Anwendung.E1])',
    );
    expect(excelToOpenFormula("SUM(B4:B8)")).toBe("of:=SUM([.B4:.B8])");
    expect(excelToOpenFormula('IF(A1="x, y",1,0)')).toBe('of:=IF([.A1]="x, y";1;0)');
  });
});

describe("ods export", () => {
  it("writes a valid package with the mimetype first and uncompressed", async () => {
    const v = completeVersion();
    const data = await exportVersionOds(v, [v], audit, settingsWithLogo());
    // Local file header: name length at 26, extra length at 28, compression method at 8.
    const dv = new DataView(data.buffer, data.byteOffset);
    const nameLen = dv.getUint16(26, true);
    expect(new TextDecoder().decode(data.slice(30, 30 + nameLen))).toBe("mimetype");
    expect(dv.getUint16(8, true)).toBe(0);
    expect(new TextDecoder().decode(data.slice(30 + nameLen + dv.getUint16(28, true), 30 + nameLen + dv.getUint16(28, true) + 46))).toBe(
      "application/vnd.oasis.opendocument.spreadsheet",
    );

    const files = unzipSync(data);
    expect(Object.keys(files)).toEqual(expect.arrayContaining(["META-INF/manifest.xml", "content.xml", "styles.xml", "meta.xml", "Pictures/logo.png"]));
    const content = strFromU8(files["content.xml"]!);
    expect(content).toContain("250.000");
    expect(content).toContain("2.500.000");
    expect(content).toContain('table:name="Hilfstabelle" table:style-name="ta_hidden"');
    expect(content).toContain("of:=IF(");
    expect(content).toContain("cell-content-is-in-list");
    expect(content).toContain("Muster GmbH");
    expect(detectSpreadsheetFormat(data)).toBe("ods");
  });

  it("round-trips answers, master data, overrides and justifications", async () => {
    const v = closeVersion(completeVersion(), "Alice");
    const r = await parseLegacyOds(await exportVersionOds(v, [v], audit, settingsWithLogo()));
    expect(r.answers).toEqual(v.answers);
    expect(r.justifications).toEqual(v.justifications);
    expect(r.overrides).toEqual(v.overrides);
    expect(r.meta).toEqual(v.meta);
    expect(r.versionLabel).toBe("1.0");
    expect(r.statusText).toBe("abgeschlossen");
    expect(r.rows.every((d) => d.confidence === "exact")).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it("carries cached formula results", async () => {
    const v = completeVersion();
    const book = odsReader(await exportVersionOds(v, [v], audit));
    const app = book.sheet("Anwendung")!;
    expect(app.cell("G9")).toBe("Hoch");
    expect(app.cell("G88")).toBe("Sehr hoch");
    expect(app.cell("E1")).toBe("Hoch");
    expect(book.sheet("Deckblatt")!.cell("D22")).toBe("Sehr hoch");
    expect(book.sheet("Hilfstabelle")!.cell("F10")).toBe("2004");
    expect(book.sheet("Audit-Trail")!.cell("H2")).toBe("Art. 9 DSGVO");
  });

  it("builds a readable file name", () => {
    expect(odsFileName(completeVersion())).toBe("SBA_Kunden_CRM_v1.0-dev.ods");
  });
});

describe("ods import", () => {
  it("reads the legacy form converted to ODS like the XLSX original", async () => {
    const [fromOds, fromXlsx] = await Promise.all([parseLegacyOds(fixture("ods")), parseLegacyXlsx(fixture("xlsx"))]);
    expect(fromOds.answers.C.legal).toMatchObject({ applies: true, level: 3 });
    expect(fromOds.answers).toEqual(fromXlsx.answers);
    expect(fromOds.meta).toEqual(fromXlsx.meta);
    expect(fromOds.rows).toEqual(fromXlsx.rows);
    expect(fromOds.issues).toEqual(fromXlsx.issues);
    expect(fromOds.candidateRows).toEqual(fromXlsx.candidateRows);
  });

  it("detects the format and dispatches", async () => {
    const v = completeVersion();
    const xlsx = await exportVersionXlsx(v, [v], audit);
    expect(detectSpreadsheetFormat(xlsx)).toBe("xlsx");
    expect(detectSpreadsheetFormat(fixture("ods"))).toBe("ods");
    expect(detectSpreadsheetFormat(new Uint8Array([1, 2, 3]))).toBeNull();
    expect((await parseLegacySpreadsheet(xlsx)).answers).toEqual(v.answers);
    expect((await parseLegacySpreadsheet(fixture("ods"))).answers.C.legal).toMatchObject({ level: 3 });
    await expect(parseLegacySpreadsheet(new Uint8Array([1, 2, 3]))).rejects.toThrow(XlsxImportError);
    await expect(parseLegacyOds(new Uint8Array([0x50, 0x4b, 3, 4]))).rejects.toThrow(XlsxImportError);
  });
});
