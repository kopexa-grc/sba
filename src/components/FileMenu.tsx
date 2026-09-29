import { useFileActions, MOD_LABEL } from "../app/file-actions";
import { versionLabel } from "../domain/versioning";
import { MenubarContent, MenubarItem, MenubarLabel, MenubarMenu, MenubarRoot, MenubarSeparator, MenubarTrigger, Shortcut } from "./menu";

/** The "Datei" menu in the top bar: create, open, import, save and export in one familiar place. */
export function FileMenu() {
  const f = useFileActions();
  const v = f.current;
  const mod = MOD_LABEL;
  const keys = (k: string, shift = false) => `${mod === "⌘" ? "Meta" : "Control"}+${shift ? "Shift+" : ""}${k}`;

  return (
    <MenubarRoot aria-label="Anwendungsmenü" data-tour="file-menu">
      <MenubarMenu>
        <MenubarTrigger>Datei</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onSelect={f.newAnalysis}>Neue Analyse …</MenubarItem>
          <MenubarItem onSelect={f.captureAssets}>Assets erfassen (Liste, CSV, Excel) …</MenubarItem>
          <MenubarItem onSelect={f.openFile} aria-keyshortcuts={keys("O")}>
            Datei öffnen …<Shortcut>{mod}O</Shortcut>
          </MenubarItem>
          <MenubarItem onSelect={f.importSheet}>Erhebungsbogen importieren (Excel, ODS) …</MenubarItem>

          <MenubarSeparator />
          <MenubarItem disabled={!v} onSelect={f.saveCurrent} aria-keyshortcuts={keys("S")}>
            {v ? `„${v.meta.name || "Unbenannt"}“ als Datei speichern` : "Analyse als Datei speichern"}
            <Shortcut>{mod}S</Shortcut>
          </MenubarItem>
          <MenubarItem onSelect={f.saveAll} aria-keyshortcuts={keys("S", true)}>
            Alle Analysen speichern
            <Shortcut>{mod === "⌘" ? "⇧⌘S" : "Strg+Umschalt+S"}</Shortcut>
          </MenubarItem>
          <MenubarItem onSelect={f.saveSettings}>Einstellungen als Datei speichern</MenubarItem>

          <MenubarSeparator />
          <MenubarLabel>{v ? `Bericht exportieren · Version ${versionLabel(v)}` : "Bericht exportieren (Analyse öffnen)"}</MenubarLabel>
          <MenubarItem disabled={!v} onSelect={() => f.exportReport("pdf")}>
            PDF-Bericht
          </MenubarItem>
          <MenubarItem disabled={!v} onSelect={() => f.exportReport("xlsx")}>
            Prüfbericht für Excel (.xlsx)
          </MenubarItem>
          <MenubarItem disabled={!v} onSelect={() => f.exportReport("ods")}>
            Prüfbericht für LibreOffice / openDesk (.ods)
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </MenubarRoot>
  );
}
