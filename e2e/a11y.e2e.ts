import { expect, test, type Page } from "@playwright/test";
import { createAnalysis, expectNoA11yViolations, gotoStep, openApp, openDialog, pickLevel, skipTours } from "./helpers";

const STEPS = ["stammdaten", "C", "I", "A", "ergebnis", "historie", "vergleich"] as const;

test.beforeEach(async ({ page }) => {
  // The app disables transitions under reduced motion; axe must not sample colors mid-transition.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await skipTours(page);
  await openApp(page);
});

test.describe("axe (WCAG 2.2 AA)", () => {
  test("overview, empty", async ({ page }, info) => {
    await expect(page.getByText("Noch keine Analysen")).toBeVisible();
    await expectNoA11yViolations(page, info, "overview-empty");
  });

  test("overview with data", async ({ page }, info) => {
    await createAnalysis(page, "Axe Übersicht");
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Axe Übersicht" })).toBeVisible();
    await expectNoA11yViolations(page, info, "overview-data");
  });

  test("workspace steps", async ({ page }, info) => {
    const base = await createAnalysis(page, "Axe Schritte");
    for (const step of STEPS) {
      await gotoStep(page, base, step);
      await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
      // Open the gate follow-up once, so option rows and text fields are checked too.
      if (step === "C") {
        await page.locator('section[id="C.legal"]').getByRole("radio", { name: "Ja", exact: true }).click();
        await expect(page.locator('section[id="C.legal"]').getByRole("radio", { name: /^erheblichen/ })).toBeVisible();
      }
      await test.step(step, () => expectNoA11yViolations(page, info, `workspace-${step}`));
    }
  });

  for (const [label, path] of [
    ["settings", "/einstellungen"],
    ["handbook", "/hilfe"],
    ["styleguide", "/styleguide"],
  ] as const) {
    test(label, async ({ page }, info) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoA11yViolations(page, info, label);
    });
  }

  test("dialogs and menu", async ({ page }, info) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Neue Analyse|Analyse anlegen/ }).first().click();
    await expect(openDialog(page)).toBeVisible();
    await expectNoA11yViolations(page, info, "dialog-new-analysis");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Bogen importieren" }).first().click();
    await expect(openDialog(page)).toBeVisible();
    await expectNoA11yViolations(page, info, "dialog-import");
    await page.keyboard.press("Escape");

    const base = await createAnalysis(page, "Axe Dialoge");
    await page.getByRole("button", { name: "Export" }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await expectNoA11yViolations(page, info, "export-menu");
    await page.keyboard.press("Escape");

    // Reason dialog: rate, then re-rate an existing rating.
    await gotoStep(page, base, "C");
    const legal = page.locator('section[id="C.legal"]');
    await legal.getByRole("radio", { name: "Ja", exact: true }).click();
    await pickLevel(legal.getByRole("radio", { name: /^geringen/ }));
    await legal.getByRole("radio", { name: /^erheblichen/ }).click(); // re-rating opens the reason dialog
    await expect(openDialog(page).filter({ hasText: "Änderungsgrund dokumentieren" })).toBeVisible();
    await expectNoA11yViolations(page, info, "dialog-reason");
  });
});

test.describe("keyboard", () => {
  test("skip link is the first focusable element and moves focus to main", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Zum Inhalt springen" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect
      .poll(() => page.evaluate(() => !!document.activeElement?.closest("main") || document.activeElement?.tagName === "MAIN"))
      .toBe(true);
  });

  test("a scenario can be answered with the keyboard only", async ({ page }) => {
    const base = await createAnalysis(page, "Tastatur");
    await gotoStep(page, base, "C");
    const legal = page.locator('section[id="C.legal"]');
    const gate = legal.getByRole("radiogroup").first();

    // Tab until focus is inside the gate radiogroup.
    await tabUntil(page, () => page.evaluate(() => !!document.activeElement?.closest('section[id="C.legal"] [role="radiogroup"]')));
    // WAI-ARIA radio group: arrow keys move and select.
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await expect(gate.getByRole("radio", { name: "Nein", exact: true })).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(gate.getByRole("radio", { name: "Ja", exact: true })).toHaveAttribute("aria-checked", "true");
    await expect(gate.getByRole("radio", { name: "Ja", exact: true })).toBeFocused();

    // Tab to the level options (rendered after the async save of "Ja") and pick the second one.
    await expect(legal.getByRole("radio", { name: /^geringen/ })).toBeVisible();
    await tabUntil(page, () =>
      page.evaluate(
        () => (document.activeElement as HTMLInputElement | null)?.type === "radio" && !!document.activeElement?.closest('section[id="C.legal"] fieldset'),
      ),
    );
    await page.keyboard.press("ArrowDown");
    await expect(legal.getByRole("radio", { name: /^erheblichen/ })).toBeChecked();

    // Explanation field is reachable and saved on blur.
    const explanation = legal.getByRole("textbox", { name: /Erläuterung/ });
    await expect(explanation).toBeVisible();
    await tabUntil(page, () => explanation.evaluate((el) => el === document.activeElement));
    await page.keyboard.type("Per Tastatur erfasst.");
    await page.keyboard.press("Tab");
    // Saved asynchronously on blur: wait for IndexedDB before reloading, a reload would cancel the write.
    await expect.poll(() => storedExplanation(page, "C", "legal")).toBe("Per Tastatur erfasst.");
    await page.reload();
    await expect(legal.getByRole("textbox", { name: /Erläuterung/ })).toHaveValue("Per Tastatur erfasst.");
  });

  test("a radiogroup is a single tab stop", async ({ page }) => {
    const base = await createAnalysis(page, "Tabstopps");
    await gotoStep(page, base, "C");
    await tabUntil(page, () => page.evaluate(() => !!document.activeElement?.closest('section[id="C.legal"] [role="radiogroup"]')));
    await page.keyboard.press("Tab");
    const stillInGroup = await page.evaluate(() => !!document.activeElement?.closest('section[id="C.legal"] [role="radiogroup"]'));
    expect(stillInGroup, "Tab should leave the Ja/Nein group after one stop (roving tabindex)").toBe(false);
  });

  test("export menu: Enter opens, arrows move, Escape closes and restores focus", async ({ page }) => {
    await createAnalysis(page, "Menü");
    const button = page.getByRole("button", { name: "Export" });
    await button.focus();
    await page.keyboard.press("Enter");
    const items = page.getByRole("menuitem");
    await expect(items.first()).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(items.first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(button).toBeFocused();
  });

  test("dialogs trap focus and return it on close", async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: /Neue Analyse|Analyse anlegen/ }).first();
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = openDialog(page);
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      // Native modal dialogs may hand focus to the browser UI (body in headless); it must never
      // land on page content behind the dialog.
      const where = await page.evaluate(() =>
        document.activeElement?.closest("dialog[open]") ? "dialog" : document.activeElement === document.body ? "browser" : "page",
      );
      expect(where, `focus after tab ${i + 1}`).not.toBe("page");
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("dialogs have an accessible name", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Neue Analyse|Analyse anlegen/ }).first().click();
    await expect(page.getByRole("dialog", { name: "Neue Schutzbedarfsanalyse" })).toBeVisible();
  });

  test("focused controls show a visible focus indicator", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const style = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        return { tag: el.tagName, text: el.textContent?.trim().slice(0, 30), outline: cs.outlineStyle, width: cs.outlineWidth, shadow: cs.boxShadow };
      });
      expect(style, "something is focused").not.toBeNull();
      const visible = (style!.outline !== "none" && style!.width !== "0px") || (style!.shadow && style!.shadow !== "none");
      expect(visible, `focus indicator on ${style!.tag} "${style!.text}"`).toBeTruthy();
    }
  });
});

test.describe("navigation semantics", () => {
  test("document title changes per route", async ({ page }) => {
    await page.goto("/");
    const overview = await page.title();
    await page.goto("/einstellungen");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const settings = await page.title();
    await page.goto("/hilfe");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const help = await page.title();
    expect(new Set([overview, settings, help]).size, `titles: ${overview} | ${settings} | ${help}`).toBe(3);
  });

  test("focus moves to the page heading after client-side navigation", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Handbuch" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.tagName))
      .toMatch(/^(H1|MAIN)$/);
  });
});

test.describe("reflow and zoom", () => {
  const noHorizontalScroll = (page: Page) =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  test("no horizontal scrolling at 320 px (WCAG 1.4.10)", async ({ page }) => {
    const base = await createAnalysis(page, "Reflow");
    await page.setViewportSize({ width: 320, height: 640 });
    for (const path of ["/", "/einstellungen", "/hilfe", `${base}/stammdaten`, `${base}/C`, `${base}/ergebnis`, `${base}/historie`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await noHorizontalScroll(page), `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
    }
  });

  test("export menu stays fully visible on phones", async ({ page }) => {
    const base = await createAnalysis(page, "Menü mobil");
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${base}/stammdaten`);
      await page.getByRole("button", { name: "Export" }).click();
      const items = page.getByRole("menuitem");
      await expect(items.first()).toBeVisible();
      for (const box of await items.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
        expect(box.left, `menu item cut off on the left at ${width}px`).toBeGreaterThanOrEqual(0);
        expect(box.right, `menu item cut off on the right at ${width}px`).toBeLessThanOrEqual(width);
      }
      await page.keyboard.press("Escape");
    }
  });

  test("usable at 200 % zoom (WCAG 1.4.4)", async ({ page }) => {
    const base = await createAnalysis(page, "Zoom");
    // 200 % zoom of a 1280 px window equals a 640 px CSS viewport.
    await page.setViewportSize({ width: 640, height: 400 });
    await page.goto(`${base}/C`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await noHorizontalScroll(page)).toBeLessThanOrEqual(0);
    const primary = page.getByRole("button", { name: "Version abschließen" });
    await primary.scrollIntoViewIfNeeded();
    await expect(primary).toBeInViewport();
    const gate = page.locator('section[id="C.legal"]').getByRole("radio", { name: "Nein", exact: true });
    await gate.click();
    await expect(gate).toHaveAttribute("aria-checked", "true");
  });
});

/** Reads a scenario explanation straight from IndexedDB (latest version). */
function storedExplanation(page: Page, goal: string, scenario: string): Promise<string | null> {
  return page.evaluate(
    ([g, sc]) =>
      new Promise<string | null>((resolve) => {
        const req = indexedDB.open("kopexa-sba");
        req.onsuccess = () => {
          const all = req.result.transaction("versions").objectStore("versions").getAll();
          all.onsuccess = () => {
            const versions = all.result as { updatedAt: string; answers: Record<string, Record<string, { explanation?: string }>> }[];
            const latest = versions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
            resolve(latest?.answers[g]?.[sc]?.explanation ?? null);
          };
        };
        req.onerror = () => resolve(null);
      }),
    [goal, scenario] as const,
  );
}

async function tabUntil(page: Page, predicate: () => Promise<boolean>, max = 80) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    if (await predicate()) return;
  }
  throw new Error(`target not reached after ${max} Tab presses`);
}
