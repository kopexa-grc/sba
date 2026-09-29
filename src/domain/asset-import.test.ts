import { describe, expect, it } from "vitest";
import {
  buildImportRows,
  detectHeaderRow,
  distinctValues,
  emptyMapping,
  parseBoolean,
  suggestMapping,
  suggestTypeMapping,
  TARGET_FIELDS,
  toTable,
} from "./asset-import";
import { META_LABEL } from "./diff";

const sheet = (rows: string[][]) => ({ name: "Test", rows });

describe("target fields", () => {
  it("use the app's field labels", () => {
    for (const f of TARGET_FIELDS) expect(f.label).toBe(META_LABEL[f.field]);
    expect(TARGET_FIELDS.filter((f) => f.required).map((f) => f.field)).toEqual(["name"]);
  });
});

describe("header detection", () => {
  it("recognizes header rows by aliases", () => {
    expect(detectHeaderRow(sheet([["Asset-Name", "Verantwortlich"], ["CRM", "Vertrieb"]]))).toBe(true);
  });

  it("recognizes unknown headers above numeric values", () => {
    expect(detectHeaderRow(sheet([["Foo", "Bar"], ["CRM", "12"], ["ERP", "7"]]))).toBe(true);
  });

  it("treats a list without header as data", () => {
    expect(
      detectHeaderRow(
        sheet([
          ["Kunden-CRM", "Anwendung", "Vertrieb"],
          ["Mailserver", "Server", "IT"],
          ["Lohnbuchhaltung", "Anwendung", "Personal"],
        ]),
      ),
    ).toBe(false);
    expect(detectHeaderRow(sheet([["2024", "x"], ["2025", "y"]]))).toBe(false);
    // A type value on top of a type column is data, even though "Anwendung" is also a header alias.
    expect(detectHeaderRow(sheet([["CRM", "Anwendung"], ["Mailserver", "Server"]]))).toBe(false);
  });

  it("builds tables with and without header row, skipping empty rows", () => {
    const s = sheet([["", ""], ["Name", "Owner"], ["CRM", "Vertrieb"], ["", ""], ["ERP", ""]]);
    const t = toTable(s, true);
    expect(t.headers).toEqual(["Name", "Owner"]);
    expect(t.rows).toEqual([
      ["CRM", "Vertrieb"],
      ["ERP", ""],
    ]);
    const raw = toTable(sheet([["CRM", "Vertrieb", "x"]]), false);
    expect(raw.headers).toEqual(["Spalte A", "Spalte B", "Spalte C"]);
    expect(raw.rows).toHaveLength(1);
  });
});

describe("mapping suggestions", () => {
  it("maps German headers", () => {
    const t = toTable(
      sheet([
        ["Asset-Bezeichnung (Pflicht)", "Asset-Typ", "Verantwortliche(r)", "Abteilung", "Standort", "Personenbezogene Daten", "Gesundheitsdaten", "Bemerkung"],
        ["CRM", "Anwendung", "M. Muster", "Vertrieb", "Frankfurt", "ja", "nein", "-"],
      ]),
      true,
    );
    const m = suggestMapping(t);
    expect(m).toMatchObject({
      name: 0,
      type: 1,
      owner: 2,
      orgUnit: 3,
      location: 4,
      personalData: 5,
      specialCategoryData: 6,
      description: 7,
      contact: null,
      scope: null,
    });
  });

  it("maps English headers and uses each column once", () => {
    const t = toTable(
      sheet([
        ["Name", "Category", "Asset Owner", "Department", "Description", "Location", "PII", "Contact"],
        ["CRM", "SaaS", "Jane", "Sales", "Customer data", "EU", "yes", "jane@example.com"],
      ]),
      true,
    );
    const m = suggestMapping(t);
    expect(m).toMatchObject({ name: 0, type: 1, owner: 2, orgUnit: 3, description: 4, location: 5, personalData: 6, contact: 7 });
    const cols = Object.values(m).filter((c): c is number => c !== null);
    expect(new Set(cols).size).toBe(cols.length);
  });

  it("detects type and name columns by content when headers are unknown", () => {
    const t = toTable(
      sheet([
        ["Nr", "Objekt-ID", "Klassifizierung", "Freitext"],
        ["1", "Kunden-CRM", "Anwendung", "a"],
        ["2", "Mailserver", "Server", "a"],
        ["3", "Lohnprozess", "Prozess", "a"],
      ]),
      true,
    );
    const m = suggestMapping(t);
    expect(m.type).toBe(2);
    expect(m.name).toBe(1);
  });

  it("returns an empty mapping for empty tables", () => {
    expect(suggestMapping({ headers: [], rows: [] })).toEqual(emptyMapping());
  });
});

describe("values", () => {
  const t = toTable(
    sheet([
      ["Name", "Typ"],
      ["A", "Anwendung"],
      ["B", "Server"],
      ["C", "Anwendung"],
      ["D", "Sonstiges"],
      ["E", ""],
    ]),
    true,
  );

  it("lists distinct values in first-seen order", () => {
    expect(distinctValues(t, 1)).toEqual(["Anwendung", "Server", "Sonstiges"]);
    expect(distinctValues(t, 1, 2)).toEqual(["Anwendung", "Server"]);
  });

  it("suggests asset types for values", () => {
    expect(suggestTypeMapping(["Anwendung", "Datenbank", "Rechenzentrum", "Sonstiges"])).toEqual({
      Anwendung: "application",
      Datenbank: "infrastructure",
      Rechenzentrum: "room",
      Sonstiges: null,
    });
  });

  it("parses booleans", () => {
    for (const v of ["ja", "Yes", "x", "✓", "1", "WAHR"]) expect(parseBoolean(v)).toBe(true);
    for (const v of ["nein", "No", "0", "falsch"]) expect(parseBoolean(v)).toBe(false);
    expect(parseBoolean("vielleicht")).toBeNull();
    expect(parseBoolean("")).toBeNull();
  });
});

describe("import rows", () => {
  it("builds rows with status, types, booleans and source line numbers", () => {
    const s = sheet([
      ["Bezeichnung", "Typ", "Owner", "PII"],
      ["Kunden-CRM", "Anwendung", " Vertrieb ", "ja"],
      ["", "", "", ""],
      ["Mailserver", "Server", "IT", "nein"],
      ["kunden-crm", "Anwendung", "", ""],
      ["", "Server", "IT", ""],
      ["ERP", "Sonstiges", "", "vielleicht"],
      ["Altes System", "", "", ""],
    ]);
    const t = toTable(s, true);
    const m = suggestMapping(t);
    const rows = buildImportRows(t, m, { Anwendung: "application", Server: "infrastructure", Sonstiges: null }, {
      defaultType: "process",
      existingNames: [" altes system "],
    });
    expect(rows.map((r) => [r.line, r.status])).toEqual([
      [2, "new"],
      [4, "new"],
      [5, "duplicate-in-file"],
      [6, "invalid"],
      [7, "new"],
      [8, "exists"],
    ]);
    expect(rows[0]!.meta).toEqual({ name: "Kunden-CRM", type: "application", owner: "Vertrieb", personalData: true });
    expect(rows[1]!.meta).toMatchObject({ type: "infrastructure", personalData: false });
    expect(rows[3]!.message).toBe("Bezeichnung fehlt");
    // Unmapped type value falls back to the default; unknown boolean is left out.
    expect(rows[4]!.meta).toEqual({ name: "ERP", type: "process" });
  });

  it("ignores unmapped fields", () => {
    const t = toTable(sheet([["Name", "Owner"], ["CRM", "Vertrieb"]]), true);
    const rows = buildImportRows(t, { ...emptyMapping(), name: 0 }, {}, { defaultType: "application", existingNames: [] });
    expect(rows[0]!.meta).toEqual({ name: "CRM", type: "application" });
  });
});
