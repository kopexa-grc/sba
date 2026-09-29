import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { exportVersionOds } from "./ods/export";
import { newVersion } from "../domain/versioning";
import { decodeText, detectDelimiter, detectTableFormat, parseCsv, readTableFile, TableReadError } from "./table-read";

const enc = (s: string) => new TextEncoder().encode(s);

describe("CSV", () => {
  it("reads semicolon CSV with BOM, quotes, escaped quotes and line breaks in cells", async () => {
    const text = '﻿Name;Typ;Beschreibung\r\n"Kunden-CRM";Anwendung;"Vertrieb; ""Key Accounts""\nund Service"\r\nMailserver;Server;\r\n\r\n';
    const [sheet] = await readTableFile("assets.csv", enc(text));
    expect(sheet!.name).toBe("assets");
    expect(sheet!.rows).toEqual([
      ["Name", "Typ", "Beschreibung"],
      ["Kunden-CRM", "Anwendung", 'Vertrieb; "Key Accounts"\nund Service'],
      ["Mailserver", "Server", ""],
    ]);
  });

  it("falls back to Windows-1252 for German Excel exports", async () => {
    // "Größe;Büro" in windows-1252: ö = 0xF6, ß = 0xDF, ü = 0xFC
    const bytes = new Uint8Array([0x47, 0x72, 0xf6, 0xdf, 0x65, 0x3b, 0x42, 0xfc, 0x72, 0x6f, 0x0a, 0x31, 0x3b, 0x32]);
    expect(decodeText(bytes).startsWith("Größe;Büro")).toBe(true);
    const [sheet] = await readTableFile("export.csv", bytes);
    expect(sheet!.rows[0]).toEqual(["Größe", "Büro"]);
  });

  it("detects comma, tab and pipe delimiters", () => {
    expect(detectDelimiter("a,b,c\n1,2,3\n")).toBe(",");
    expect(detectDelimiter("a\tb\tc\n1\t2\t3\n")).toBe("\t");
    expect(detectDelimiter("a|b\n1|2\n")).toBe("|");
    // Commas inside quoted fields do not confuse semicolon detection.
    expect(detectDelimiter('Name;Beschreibung\n"A";"x, y, z"\n"B";"u, v"\n')).toBe(";");
    expect(parseCsv("Name,Owner\nCRM,Vertrieb\n")).toEqual([
      ["Name", "Owner"],
      ["CRM", "Vertrieb"],
    ]);
  });

  it("pads rows and trims trailing empty rows and columns", async () => {
    const [sheet] = await readTableFile("x.tsv", enc("a\tb\t\t\n c \n\t\t\n"));
    expect(sheet!.rows).toEqual([
      ["a", "b"],
      ["c", ""],
    ]);
  });

  it("rejects empty and unsupported files", async () => {
    await expect(readTableFile("leer.csv", new Uint8Array())).rejects.toThrow(TableReadError);
    await expect(readTableFile("nur-leer.csv", enc(";;\n;;\n"))).rejects.toThrow(/keine Daten/);
    await expect(readTableFile("alt.xls", new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0]))).rejects.toThrow(/\.xls/);
  });
});

describe("format detection", () => {
  it("uses content before extension", async () => {
    const ods = readFileSync("test/fixtures/FS_Schutzbedarfsanalyse_neu.ods");
    const xlsx = readFileSync("test/fixtures/FS_Schutzbedarfsanalyse_neu.xlsx");
    expect(detectTableFormat("falsch.xlsx", new Uint8Array(ods))).toBe("ods");
    expect(detectTableFormat("liste.xlsx", new Uint8Array(xlsx))).toBe("xlsx");
    expect(detectTableFormat("liste.csv", enc("a;b"))).toBe("csv");
    expect(detectTableFormat("liste", enc("a;b"))).toBe("csv");
    expect(detectTableFormat("bild.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1]))).toBeNull();
  });
});

describe("XLSX", () => {
  it("reads all visible sheets with dates, numbers, formulas and rich text", async () => {
    const wb = new ExcelJS.Workbook();
    const a = wb.addWorksheet("Assets");
    a.addRow(["Bezeichnung", "Seit", "Anzahl", "Summe", "Notiz"]);
    a.addRow(["Kunden-CRM", new Date(Date.UTC(2024, 2, 5)), 0.1 + 0.2, { formula: "C2*2", result: 0.6 }, { richText: [{ text: "fett " }, { text: "normal" }] }]);
    a.addRow(["Mailserver", null, 42, null, { text: "Link", hyperlink: "https://example.com" }]);
    const b = wb.addWorksheet("Standorte");
    b.addRow(["Standort"]);
    b.addRow(["Frankfurt"]);
    const hidden = wb.addWorksheet("Intern");
    hidden.state = "hidden";
    hidden.addRow(["geheim"]);
    const buf = new Uint8Array(await wb.xlsx.writeBuffer());

    const sheets = await readTableFile("inventar.xlsx", buf);
    expect(sheets.map((s) => s.name)).toEqual(["Assets", "Standorte"]);
    expect(sheets[0]!.rows).toEqual([
      ["Bezeichnung", "Seit", "Anzahl", "Summe", "Notiz"],
      ["Kunden-CRM", "05.03.2024", "0,3", "0,6", "fett normal"],
      ["Mailserver", "", "42", "", "Link"],
    ]);
    expect(sheets[1]!.rows).toEqual([["Standort"], ["Frankfurt"]]);
  });

  it("reports corrupt workbooks", async () => {
    const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5]);
    await expect(readTableFile("kaputt.xlsx", zipHeader)).rejects.toThrow(TableReadError);
  });
});

describe("ODS", () => {
  it("reads the legacy form converted by LibreOffice", async () => {
    const sheets = await readTableFile("bogen.ods", new Uint8Array(readFileSync("test/fixtures/FS_Schutzbedarfsanalyse_neu.ods")));
    const names = sheets.map((s) => s.name);
    expect(names).toContain("Deckblatt");
    expect(names).toContain("Anwendung");
    // Hidden helper sheet is skipped.
    expect(names).not.toContain("Hilfstabelle");
    const anwendung = sheets.find((s) => s.name === "Anwendung")!;
    // Row 3, column D (index 3) holds the first gate question; E3 = "Ja".
    expect(anwendung.rows[2]![3]).toMatch(/^Erfordern Gesetze, Vorschriften/);
    expect(anwendung.rows[2]![4]).toBe("Ja");
  });

  it("reads an ODS written by the app", async () => {
    const v = newVersion("a", "alice", { name: "Kunden-CRM" });
    const bytes = await exportVersionOds(v, [v], []);
    const sheets = await readTableFile("export.ods", bytes);
    const cover = sheets.find((s) => s.name === "Deckblatt")!;
    // D5 holds the asset name.
    expect(cover.rows[4]![3]).toBe("Kunden-CRM");
  });

  it("reports corrupt packages", async () => {
    const fake = new TextEncoder().encode("PK\u0003\u0004mimetypeapplication/vnd.oasis.opendocument.spreadsheet");
    await expect(readTableFile("kaputt.ods", fake)).rejects.toThrow(TableReadError);
  });
});
