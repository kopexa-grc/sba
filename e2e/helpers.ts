import AxeBuilder from "@axe-core/playwright";
import { expect, type Download, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";

export const FIXTURES = new URL("../test/fixtures/", import.meta.url).pathname;

/** Marks both guided tours as done before any app code runs. */
export async function skipTours(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("sba:tour:overview", "done");
      localStorage.setItem("sba:tour:workspace", "done");
    } catch {
      /* storage may be unavailable */
    }
  });
}

/** The currently open modal dialog (native <dialog open>). */
export function openDialog(page: Page): Locator {
  return page.locator("dialog[open]");
}

const NAME_DIALOG = /Ihr Name für Bericht und Änderungsprotokoll/;
// LEGACY (current code): the app asks for the name on first visit in a welcome dialog.
// The new contract asks only when closing a version or exporting. Remove once shipped.
const LEGACY_WELCOME = /Willkommen bei der Kopexa/;

/** Fills a name dialog if the given dialog is one. Returns true when it handled it. */
async function fillIfNameDialog(dialog: Locator): Promise<boolean> {
  const text = await dialog.innerText();
  if (!NAME_DIALOG.test(text) && !LEGACY_WELCOME.test(text)) return false;
  await dialog.getByRole("textbox", { name: /^Name/ }).fill("Erika Musterfrau");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog.filter({ hasText: text.slice(0, 20) })).toHaveCount(0);
  return true;
}

/** Opens the app and deals with the legacy welcome dialog if the current build still shows it. */
export async function openApp(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.locator("main")).toBeVisible();
  const welcome = openDialog(page).filter({ hasText: LEGACY_WELCOME });
  // LEGACY: bounded wait only needed while the welcome dialog exists.
  if (await welcome.waitFor({ state: "visible", timeout: 2500 }).then(() => true, () => false)) {
    await fillIfNameDialog(welcome);
  }
}

/** Clicks a trigger; if the name dialog opens first, fills it and waits for the real dialog. */
export async function clickExpectingDialog(page: Page, trigger: Locator, expected: RegExp): Promise<Locator> {
  await trigger.click();
  const dialog = openDialog(page);
  await expect(dialog).toBeVisible();
  if (await fillIfNameDialog(dialog)) {
    // Contract: after the name is saved the originally requested dialog/action continues.
    // If it does not reopen automatically, trigger it again.
    const reopened = await openDialog(page)
      .filter({ hasText: expected })
      .waitFor({ state: "visible", timeout: 2000 })
      .then(() => true, () => false);
    if (!reopened) await trigger.click();
  }
  const target = openDialog(page).filter({ hasText: expected });
  await expect(target).toBeVisible();
  return target;
}

/** The "Datei" trigger in the application menu bar. */
export function fileMenu(page: Page): Locator {
  return page.getByRole("menubar").getByRole("menuitem", { name: "Datei" });
}

/** Opens the "Datei" menu and selects an item. */
export async function fileMenuSelect(page: Page, item: RegExp | string) {
  await fileMenu(page).click();
  await page.getByRole("menu").getByRole("menuitem", { name: item }).click();
}

/** Selects an item of the "Datei" menu and returns the download; handles a name prompt in between. */
export async function exportVia(page: Page, item: RegExp): Promise<Download> {
  const pick = () => fileMenuSelect(page, item);
  const downloadPromise = page.waitForEvent("download", { timeout: 45_000 });
  await pick();
  const nameDialog = openDialog(page).filter({ hasText: NAME_DIALOG });
  const first = await Promise.race([
    downloadPromise.then((d) => ({ kind: "download" as const, d })),
    nameDialog.waitFor({ state: "visible", timeout: 45_000 }).then(() => ({ kind: "name" as const })),
  ]);
  if (first.kind === "download") return first.d;
  await fillIfNameDialog(nameDialog);
  // After naming, either the export continues or the user repeats it.
  const again = await downloadPromise.then(
    (d) => d,
    () => null,
  );
  if (again) return again;
  const retry = page.waitForEvent("download", { timeout: 45_000 });
  await pick();
  return retry;
}

export async function downloadBytes(d: Download): Promise<Buffer> {
  const path = await d.path();
  expect(path, "download has a local path").toBeTruthy();
  return readFile(path!);
}

/** Creates an analysis via the overview and waits for the workspace. Returns the workspace base URL path. */
export async function createAnalysis(page: Page, name: string): Promise<string> {
  await page.goto("/");
  const header = page.getByRole("button", { name: "Neue Analyse" });
  const empty = page.getByRole("button", { name: "Analyse anlegen" });
  await expect(header.or(empty).first()).toBeVisible();
  await (await header.isVisible() ? header : empty.first()).click();
  const dialog = openDialog(page);
  await dialog.getByRole("textbox", { name: /Asset-Bezeichnung/ }).fill(name);
  await dialog.getByRole("button", { name: "Analyse anlegen" }).click();
  await expect(page).toHaveURL(/\/a\/[^/]+\/v\/[^/]+/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return new URL(page.url()).pathname.replace(/\/(stammdaten|C|I|A|ergebnis|historie|vergleich)$/, "");
}

export async function gotoStep(page: Page, base: string, step: string) {
  await page.goto(`${base}/${step}`);
  await expect(page.locator("main")).toBeVisible();
}

/** Answers the gate question of one scenario card. */
export async function answerGate(section: Locator, value: "Ja" | "Nein") {
  const radio = section.getByRole("radiogroup").first().getByRole("radio", { name: value, exact: true });
  await radio.click();
  await expect(radio).toHaveAttribute("aria-checked", "true");
}

/** Answers every scenario of a goal with "Nein". */
export async function answerAllNein(page: Page, base: string, goal: "C" | "I" | "A") {
  await gotoStep(page, base, goal);
  const sections = page.locator(`section[id^="${goal}."]`);
  await expect(sections.first()).toBeVisible();
  const n = await sections.count();
  for (let i = 0; i < n; i++) await answerGate(sections.nth(i), "Nein");
}

/** Level options are controlled radios updated after an async save: click, then poll. */
export async function pickLevel(radio: Locator) {
  await radio.click();
  await expect(radio).toBeChecked();
}

/** Fills a commit-on-blur text field and blurs it so the change is saved. */
export async function fillAndCommit(field: Locator, text: string) {
  await field.fill(text);
  await field.blur();
}

/** Runs axe for WCAG 2.2 AA and fails with the full violation list attached. */
export async function expectNoA11yViolations(page: Page, testInfo: TestInfo, label: string, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]);
  if (include) builder = builder.include(include);
  const results = await builder.analyze();
  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => ({ target: n.target.join(" "), summary: n.failureSummary })),
  }));
  if (violations.length > 0) {
    await testInfo.attach(`axe-${label}.json`, { body: JSON.stringify(violations, null, 2), contentType: "application/json" });
  }
  expect(
    violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target).join(" | ")}`),
    `axe violations on ${label}`,
  ).toEqual([]);
}
