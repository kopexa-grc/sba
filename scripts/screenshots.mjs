// Captures README screenshots from a running build (default http://localhost:4180).
// Usage: node scripts/screenshots.mjs [baseUrl]
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:4180";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 2, acceptDownloads: true, locale: "de-DE" });
await context.addInitScript(() => {
  localStorage.setItem("sba:tour:overview", "done");
  localStorage.setItem("sba:tour:workspace", "done");
});
const page = await context.newPage();
const shot = (name, opts = {}) => page.screenshot({ path: `${OUT}/${name}.png`, ...opts });
const dialog = () => page.getByRole("dialog").filter({ visible: true });

// Organisation and scheme.
await page.goto(`${BASE}/einstellungen`);
await page.getByLabel("Name der Organisation").fill("Musterstadtwerke GmbH");
await page.getByRole("button", { name: "Speichern", exact: true }).click();
await page.getByRole("status").getByText(/^Gespeichert/).waitFor();

// Assets from CSV.
await page.goto(BASE);
await page.getByRole("button", { name: "Assets erfassen" }).first().click();
await dialog().getByRole("tab", { name: "Aus Datei importieren" }).click();
// A varied example inventory (the test fixture deliberately contains duplicates and gaps).
const csv = [
  "Asset-Name;Kategorie;Verantwortlich;Standort",
  "Mailserver;Server;IT-Betrieb;RZ Frankfurt",
  "Lohnabrechnung;Prozess;Personalabteilung;Berlin",
  "Webshop;SaaS;E-Commerce;Cloud (EU)",
  "Dokumentenmanagement;Anwendung;Verwaltung;RZ Frankfurt",
  "Serverraum Nord;Raum;Facility Management;Gebäude A",
].join("\n");
writeFileSync(".playwright-mcp/sba-assets.csv", csv);
await dialog().locator('input[type="file"]').setInputFiles(".playwright-mcp/sba-assets.csv");
await dialog().getByText("Spalten zuordnen").waitFor();
await page.waitForTimeout(300);
await dialog().screenshot({ path: `${OUT}/import-mapping.png` });
await dialog().getByRole("button", { name: "Weiter zur Vorschau" }).click();
await dialog().getByRole("button", { name: /Analysen anlegen/ }).click();
await page.getByRole("link", { name: "Lohnabrechnung" }).waitFor();

// A realistic analysis: answered, justified, closed, then a second version with a change.
await page.getByRole("button", { name: "Neue Analyse" }).click();
await dialog().getByLabel("Asset-Bezeichnung").fill("Kunden-CRM");
await dialog().getByRole("button", { name: "Analyse anlegen" }).click();
await page.waitForURL(/\/a\//);
const base = page.url().replace(/\/(stammdaten)?$/, "");

async function answer(goal, id, gate, levelText, explanation) {
  await page.goto(`${base}/${goal}`);
  const sec = page.locator(`section[id="${goal}.${id}"]`);
  await sec.getByRole("radio", { name: gate }).click();
  if (levelText) {
    await sec.locator("label", { hasText: levelText }).first().click();
    const reason = page.getByRole("dialog").filter({ hasText: "Änderungsgrund" });
    if (await reason.isVisible().catch(() => false)) {
      await reason.getByRole("textbox").fill("Neue Vertragslage mit Großkunden");
      await reason.getByRole("button", { name: "Änderung speichern" }).click();
    }
  }
  if (explanation) {
    await sec.getByLabel(/Erläuterung/).fill(explanation);
    await sec.getByLabel(/Erläuterung/).blur();
  }
  await page.waitForTimeout(400);
}

await page.goto(`${base}/stammdaten`);
await page.getByLabel(/Asset-Owner/).fill("Leitung Vertrieb");
await page.getByLabel(/Ersteller:in/).fill("Informationssicherheit");
await page.getByLabel(/Geltungsbereich/).fill("Produktivsystem inkl. Schnittstellen zu ERP und Newsletter-Dienst");
await page.getByLabel(/Geltungsbereich/).blur();
await page.waitForTimeout(400);
await page.getByRole("radiogroup", { name: "Personenbezogene Daten" }).getByRole("radio", { name: "Ja" }).click();
await page.getByRole("radiogroup", { name: /Besondere Kategorien/ }).getByRole("radio", { name: "Nein" }).click();
for (const goal of ["C", "I", "A"]) {
  await page.goto(`${base}/${goal}`);
  const groups = page.locator(`section[id^="${goal}."] [role=radiogroup]`);
  await groups.first().waitFor();
  const n = await groups.count();
  for (let i = 0; i < n; i++) {
    await groups.nth(i).getByRole("radio", { name: "Nein" }).click();
    await groups.nth(i).getByRole("radio", { name: "Nein", checked: true }).waitFor();
  }
  // Wait until every answer is stored before leaving the page.
  await page.getByText(`${n} von ${n} bewertet`).first().waitFor();
}
await answer("C", "privacy", "Ja", "erhebliche Auswirkungen", "Kontakt- und Vertragsdaten von ca. 120.000 Kund:innen; Meldepflicht nach Art. 33 DSGVO.");
await answer("C", "legal", "Ja", "erheblichen Verstößen", "Vertraulichkeitsvereinbarungen mit Großkunden sehen Vertragsstrafen vor.");
await answer("I", "privacy", "Ja", "geringfügige Auswirkungen", "");
await answer("A", "privacy", "Ja", "keine Auswirkungen", "");
await answer("A", "operations", "Ja", "fundamentale Auswirkungen", "Der Kundenservice arbeitet ausschließlich im CRM; tolerierbar ist höchstens eine Stunde.");
await page.goto(`${base}/A`);
await page.locator('section[id="A.operations"]').scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -120));
await shot("questionnaire");

await page.goto(`${base}/ergebnis`);
const just = page.getByLabel(/Begründung des Schutzbedarfs/);
await just.nth(0).fill("Umfangreiche personenbezogene Kundendaten mit vertraglichen Vertraulichkeitspflichten.");
await just.nth(0).blur();
await just.nth(2).fill("Kernprozess Kundenservice ist vollständig vom CRM abhängig (RTO ≤ 1 h).");
await just.nth(2).blur();
await page.waitForTimeout(300);
await shot("result");
await page.getByRole("heading", { name: "Wie geht es weiter?" }).evaluate((h) => window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 100));
await page.waitForTimeout(200);
await shot("next-steps");

// Close version (asks for the name once).
await page.getByRole("button", { name: "Version abschließen" }).click();

const nameDialog = page.getByRole("dialog").filter({ hasText: "Ihr Name" });
await nameDialog.getByRole("textbox", { name: /Name/ }).first().fill("Anna Beispiel");
await nameDialog.getByRole("button", { name: "Speichern" }).click();
await page.getByRole("dialog").filter({ hasText: "abschließen" }).getByRole("button", { name: "Abschließen" }).click();
await page.getByRole("button", { name: "Neue Version anlegen" }).waitFor();

// PDF report pages.
await page.getByRole("menubar").getByRole("menuitem", { name: "Datei" }).click();
await page.waitForTimeout(250);
await shot("file-menu", { clip: { x: 0, y: 0, width: 760, height: 520 } });
const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: "PDF-Bericht" }).click()]);
await pdf.saveAs(`${OUT}/report.pdf`);

// Second version with a change, then compare.
await page.getByRole("button", { name: "Neue Version anlegen" }).click();
await page.getByRole("dialog").getByRole("textbox").fill("Jährliche Überprüfung 2027");
await page.getByRole("dialog").getByRole("button", { name: /anlegen/ }).click();
await page.waitForURL(/stammdaten/);
const base2 = page.url().replace(/\/stammdaten$/, "");
await page.getByLabel(/Asset-Owner/).fill("Leitung Vertrieb & Service");
await page.getByLabel(/Asset-Owner/).blur();
await page.waitForTimeout(600);
await page.goto(`${base2}/I`);
const fin = page.locator('section[id="I.financial"]');
await fin.getByRole("radio", { name: "Ja" }).click();
await fin.locator("label", { hasText: "mehr als 1.000.000" }).first().click();
const reason = page.getByRole("dialog").filter({ hasText: "Änderungsgrund" });
await reason.getByRole("textbox").fill("Neuer Großkundenvertrag mit Pönale");
await reason.getByRole("button", { name: "Änderung speichern" }).click();
await fin.locator("input[type=radio]:checked").waitFor();
await page.waitForTimeout(500);
await fin.getByLabel(/Erläuterung/).fill("Pönale bis 2 Mio. € bei fehlerhaften Abrechnungsdaten.");
await fin.getByLabel(/Erläuterung/).blur();
await page.waitForTimeout(800);
await page.goto(`${base2}/vergleich`);
await page.waitForTimeout(400);
await shot("compare");

// Overview (saved as file first, so the backup reminder is not shown).
await page.goto(BASE);
await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Jetzt als Datei speichern" }).or(page.getByRole("button", { name: "Jetzt als Datei speichern" })).click()]);
await page.goto(BASE);
await page.waitForTimeout(500);
await shot("overview");

// Mobile.
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/C`);
await page.waitForTimeout(400);
await shot("mobile");

await browser.close();

// Render report pages to PNG.
execFileSync("pdftoppm", ["-png", "-r", "110", "-f", "1", "-l", "1", `${OUT}/report.pdf`, `${OUT}/report-summary`]);
execFileSync("pdftoppm", ["-png", "-r", "110", "-f", "4", "-l", "4", `${OUT}/report.pdf`, `${OUT}/report-signoff`]);
console.log("done");
