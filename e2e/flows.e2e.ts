import { expect, test } from "@playwright/test";
import { FIXTURES, answerAllNein, answerGate, clickExpectingDialog, createAnalysis, downloadBytes, exportVia, fileMenuSelect, fillAndCommit, gotoStep, openApp, openDialog, pickLevel, skipTours } from "./helpers";

test.describe("core flows", () => {
  test.beforeEach(async ({ page }) => {
    await skipTours(page);
    await openApp(page);
  });

  test("assess, close, branch, re-rate, compare and export", async ({ page }) => {
    const base = await createAnalysis(page, "E2E CRM");
    // Asset owner is mandatory before a version can be closed.
    await gotoStep(page, base, "stammdaten");
    await fillAndCommit(page.getByRole("textbox", { name: /Asset-Owner/ }), "Vertrieb");

    // Answer all 17 scenarios with "Nein", then escalate confidentiality/legal to "Hoch".
    for (const goal of ["C", "I", "A"] as const) await answerAllNein(page, base, goal);
    await gotoStep(page, base, "C");
    const legal = page.locator('section[id="C.legal"]');
    await answerGate(legal, "Ja");
    await pickLevel(legal.getByRole("radio", { name: /^erheblichen Verstößen/ }));
    await fillAndCommit(legal.getByRole("textbox", { name: /Erläuterung/ }), "Vertragsstrafen aus NDA mit Großkunden.");
    await expect(legal.getByText("Hoch", { exact: true }).first()).toBeVisible();

    // Mandatory justification for the goal rated "Hoch".
    await gotoStep(page, base, "ergebnis");
    await fillAndCommit(
      page.getByRole("textbox", { name: /Begründung des Schutzbedarfs/ }).first(),
      "Vertragliche Geheimhaltung gegenüber Großkunden.",
    );
    // No blocking issues left (warnings for optional fields may remain).
    await expect(page.getByRole("complementary").getByRole("heading", { name: /Offene Punkte 0/ })).toBeVisible();

    // Close version 1.0 (may ask for the name first).
    const close = await clickExpectingDialog(page, page.getByRole("button", { name: "Version abschließen" }), /abschließen/);
    await close.getByRole("button", { name: "Abschließen", exact: true }).click();
    await expect(page.getByRole("button", { name: "Neue Version anlegen" })).toBeVisible();

    // Branch 1.1.
    await page.getByRole("button", { name: "Neue Version anlegen" }).click();
    const branch = openDialog(page);
    await branch.getByRole("textbox", { name: /Anlass/ }).fill("Jährliche Überprüfung");
    await branch.getByRole("button", { name: "Version 1.1 anlegen" }).click();
    await expect(page).toHaveURL(/\/stammdaten$/);
    const base11 = new URL(page.url()).pathname.replace(/\/stammdaten$/, "");

    // Re-rate: Hoch -> Sehr hoch requires a documented reason.
    await gotoStep(page, base11, "C");
    await page.locator('section[id="C.legal"]').getByRole("radio", { name: /^fundamentalen Verstößen/ }).click(); // opens the reason dialog
    const reason = openDialog(page).filter({ hasText: "Änderungsgrund dokumentieren" });
    await expect(reason).toBeVisible();
    await reason.getByRole("textbox", { name: /Änderungsgrund/ }).fill("Neuer Großkundenvertrag mit Pönale.");
    await reason.getByRole("button", { name: "Änderung speichern" }).click();
    await expect(reason).toHaveCount(0);

    // Compare 1.0 -> 1.1 shows the escalation.
    await page.getByRole("link", { name: "Versionsvergleich" }).click();
    const row = page.getByRole("row", { name: /Vertraulichkeit · Gesetze & Verträge/ }).first();
    await expect(row).toContainText("Hoch");
    await expect(row).toContainText("Sehr hoch");

    // Exports.
    const pdf = await downloadBytes(await exportVia(page, /^PDF-Bericht/));
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    const xlsx = await downloadBytes(await exportVia(page, /Excel \(\.xlsx\)/));
    expect(xlsx.subarray(0, 2).toString()).toBe("PK");
    const ods = await downloadBytes(await exportVia(page, /\.ods\)/));
    expect(ods.subarray(0, 2).toString()).toBe("PK");
    expect(ods.toString("latin1", 30, 90)).toContain("application/vnd.oasis.opendocument.spreadsheet");
    // The app's own file format is saved via its own button, not the export menu.
    const [sbaDownload] = await Promise.all([
      page.waitForEvent("download"),
      fileMenuSelect(page, /^„.*“ als Datei speichern/),
    ]);
    expect(sbaDownload.suggestedFilename()).toMatch(/\.sba$/);
    const sba = await downloadBytes(sbaDownload);
    expect([sba[0], sba[1]]).toEqual([0x1f, 0x8b]);
  });

  test("keyboard shortcut saves the open analysis as .sba", async ({ page }) => {
    await createAnalysis(page, "Tastenkürzel");
    const [download] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("ControlOrMeta+s")]);
    expect(download.suggestedFilename()).toMatch(/^SBA_Tastenkurzel_.*\.sba$/);
    const bytes = await downloadBytes(download);
    expect([bytes[0], bytes[1]]).toEqual([0x1f, 0x8b]);
  });

  test("capture assets: paste a list", async ({ page }) => {
    await openApp(page);
    await fileMenuSelect(page, /Assets erfassen/);
    const dialog = openDialog(page);
    const first = dialog.getByRole("textbox", { name: "Bezeichnung, Zeile 1" });
    await first.focus();
    await page.evaluate(() => {
      const data = new DataTransfer();
      data.setData("text/plain", "Firewall\tInfrastruktur\tIT\nWebshop\tAnwendung\tE-Commerce\n");
      document.activeElement?.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await expect(dialog.getByRole("textbox", { name: "Bezeichnung, Zeile 2" })).toHaveValue("Webshop");
    await dialog.getByRole("button", { name: "2 Analysen anlegen" }).click();
    await expect(page.getByRole("link", { name: "Firewall" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Webshop" })).toBeVisible();
  });

  test("capture assets: CSV import with column mapping", async ({ page }) => {
    await openApp(page);
    await fileMenuSelect(page, /Assets erfassen/);
    const dialog = openDialog(page);
    await dialog.getByRole("tab", { name: "Aus Datei importieren" }).click();
    await dialog.locator('input[type="file"]').setInputFiles(FIXTURES + "assets.csv");
    // Suggested mapping from the German headers.
    await expect(dialog.getByRole("combobox", { name: /^Asset-Bezeichnung/ })).toHaveValue("0");
    await expect(dialog.getByRole("combobox", { name: /^Asset-Owner/ })).toHaveValue("2");
    await expect(dialog.getByRole("combobox", { name: /^Standort/ })).toHaveValue("3");
    // Type values mapped by content ("SaaS" → Anwendung).
    await expect(dialog.getByRole("combobox", { name: "„SaaS“" })).toHaveValue("application");
    await dialog.getByRole("button", { name: "Weiter zur Vorschau" }).click();
    await expect(dialog).toContainText("4 neu");
    await expect(dialog).toContainText("Doppelt in der Datei");
    await expect(dialog).toContainText("Fehlerhaft");
    await dialog.getByRole("button", { name: "4 Analysen anlegen" }).click();
    await expect(page.getByRole("link", { name: 'Serverraum "Nord"' })).toBeVisible();
    await expect(page.getByRole("link", { name: "Lohnabrechnung" })).toBeVisible();
  });

  test("custom rating scheme flows into new analyses", async ({ page }) => {
    await page.goto("/einstellungen");
    await page.getByRole("spinbutton", { name: /Finanzieller Schaden „Hoch“ ab/ }).fill("250000");
    await page.getByRole("spinbutton", { name: /Finanzieller Schaden „Sehr hoch“ ab/ }).fill("2500000");
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    // Wait for the confirmation toast, not just any text containing "Gespeichert".
    await expect(page.getByRole("status").getByText(/^Gespeichert\./)).toBeVisible();

    const base = await createAnalysis(page, "Schema-Test");
    await gotoStep(page, base, "A");
    const fin = page.locator('section[id="A.financial"]');
    await answerGate(fin, "Ja");
    await expect(fin.getByText(/mehr als 250\.000\s€/)).toBeVisible();
    await expect(fin.getByText(/mehr als 2\.500\.000\s€/)).toBeVisible();
  });

  test("backup, wipe and restore", async ({ page }) => {
    await createAnalysis(page, "Sicherungstest");
    await page.goto("/einstellungen");
    const backupPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Alles speichern" }).click();
    const backup = await backupPromise;
    expect(backup.suggestedFilename()).toMatch(/\.sba$/);
    const backupPath = test.info().outputPath("backup.sba");
    await backup.saveAs(backupPath);

    await page.getByRole("button", { name: "Alles löschen …" }).click();
    const wipe = openDialog(page);
    await wipe.getByRole("textbox", { name: /LÖSCHEN/ }).fill("LÖSCHEN");
    await wipe.getByRole("button", { name: "Endgültig löschen" }).click();
    await expect(page.getByText("Alle Daten wurden gelöscht.")).toBeVisible();
    await page.goto("/");
    await expect(page.getByText("Noch keine Analysen")).toBeVisible();

    await page.goto("/einstellungen");
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Datei öffnen" }).click();
    await (await chooser).setFiles(backupPath);
    const dialog = openDialog(page);
    await expect(dialog).toContainText("Einstellungen und Analysen");
    await dialog.getByRole("button", { name: "Übernehmen" }).click();
    await expect(page.getByText(/1 Analysen, 1 Versionen übernommen/)).toBeVisible();
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Sicherungstest" })).toBeVisible();
  });

  for (const file of ["FS_Schutzbedarfsanalyse_neu.xlsx", "FS_Schutzbedarfsanalyse_neu.ods"]) {
    test(`legacy import: ${file}`, async ({ page }) => {
      await page.goto("/");
      await fileMenuSelect(page, /Erhebungsbogen importieren/);
      await openDialog(page).locator('input[type="file"]').setInputFiles(FIXTURES + file);
      const review = openDialog(page).filter({ hasText: "Bogen prüfen und übernehmen" });
      await expect(review).toBeVisible();
      const legalRow = review.locator("table").first().getByRole("row").first();
      await expect(legalRow).toContainText("Gesetze & Verträge");
      await expect(legalRow).toContainText("Sehr hoch");
      await review.getByRole("textbox", { name: /Asset-Bezeichnung/ }).fill(`Import ${file}`);
      await review.getByRole("button", { name: "Als Entwurf übernehmen" }).click();
      await expect(page).toHaveURL(/\/ergebnis$/);
      await expect(page.getByRole("heading", { level: 1, name: `Import ${file}` })).toBeVisible();
    });
  }
});

test.describe("first visit (contract)", () => {
  test("no name dialog on first visit", async ({ page }) => {
    await skipTours(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // CONTRACT: the name is only requested when closing a version or exporting.
    await expect(openDialog(page)).toHaveCount(0);
  });

  test("empty overview offers create, sample and import", async ({ page }) => {
    await skipTours(page);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Analyse anlegen" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Erhebungsbogen übernehmen" })).toBeVisible();
    // CONTRACT: sample analysis.
    await page.getByRole("button", { name: "Beispiel ansehen" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Beispiel: Kunden-CRM" })).toBeVisible();
  });

  test("guided tour on first visit, dismissible and not shown again", async ({ page }) => {
    await page.goto("/");
    // CONTRACT: tour dialog with Weiter / Zurück / Tour beenden.
    const tour = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Tour beenden" }) });
    await expect(tour).toBeVisible();
    await tour.getByRole("button", { name: "Weiter" }).click();
    await expect(tour.getByRole("button", { name: "Zurück" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tour).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(tour).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("sba:tour:overview"))).toBe("done");
  });

  test("footer links to Kopexa legal pages", async ({ page }) => {
    await skipTours(page);
    await openApp(page);
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: "Impressum" })).toHaveAttribute("href", /kopexa\.com\/de\/legal\/imprint/);
    await expect(footer.getByRole("link", { name: "Datenschutz" })).toHaveAttribute("href", /kopexa\.com\/de\/legal\/privacy/);
    await expect(footer.getByRole("link", { name: "Barrierefreiheit" })).toHaveAttribute(
      "href",
      /kopexa\.com\/de\/legal\/accessibility-statement/,
    );
  });
});
