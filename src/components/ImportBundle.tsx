import { useEffect, useState } from "react";
import { useSession } from "../app/session";
import { repo } from "../db/repo";
import { formatEuro, formatHours } from "../domain/scheme";
import type { ParsedBundle } from "../io/json";
import { Button, Dialog, Notice } from "./ui";

const KIND_LABEL = {
  settings: "Einstellungen",
  assessments: "Analysen",
  backup: "Vollständige Sicherung",
} as const;

/** Preview and selective import of any .sba file (settings, analyses or both). */
export function ImportBundleDialog({ bundle, onClose }: { bundle: ParsedBundle | null; onClose: () => void }) {
  const { notify, guard } = useSession();
  const [takeSettings, setTakeSettings] = useState(true);
  const [takeAssets, setTakeAssets] = useState(true);
  useEffect(() => {
    setTakeSettings(true);
    setTakeAssets(true);
  }, [bundle]);

  const settings = bundle?.settings ?? null;
  const records = bundle?.records ?? [];
  const versions = records.reduce((n, r) => n + r.versions.length, 0);
  const nothing = (!settings || !takeSettings) && (records.length === 0 || !takeAssets);

  async function confirm() {
    if (!bundle) return;
    const done = await guard(async () => {
      const parts: string[] = [];
      if (settings && takeSettings) {
        await repo.saveSettings(settings);
        parts.push("Einstellungen übernommen");
      }
      if (records.length > 0 && takeAssets) {
        const res = await repo.importRecords(records);
        parts.push(`${res.assets} Analysen, ${res.versions} Versionen übernommen${res.skipped ? `, ${res.skipped} bereits vorhanden` : ""}`);
      }
      return parts.join(" · ");
    });
    if (done === undefined) return;
    onClose();
    notify(`${done}.`);
  }

  return (
    <Dialog
      open={!!bundle}
      onClose={onClose}
      title={bundle ? `${KIND_LABEL[bundle.kind]} einlesen` : "Datei einlesen"}
      description="Wählen Sie, was übernommen werden soll. Vorhandene Analysen werden nicht überschrieben."
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" disabled={nothing} onClick={confirm}>
            Übernehmen
          </Button>
        </>
      }
    >
      {bundle && (
        <div className="grid gap-5 text-[14px]">
          {bundle.migratedFrom && (
            <Notice>
              Die Datei stammt aus einer älteren Version der App (Format {bundle.migratedFrom}). Frühere Freigaben werden als
              abgeschlossene Versionen übernommen.
            </Notice>
          )}

          {settings && (
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-[4px] size-3.5 accent-primary-950"
                checked={takeSettings}
                onChange={(e) => setTakeSettings(e.target.checked)}
              />
              <span>
                Einstellungen übernehmen
                <span className="mt-0.5 block text-[13px] text-muted">
                  {settings.organization.name ? `${settings.organization.name} · ` : ""}Schema „{settings.scheme.name}“: hoch ab{" "}
                  {formatEuro(settings.scheme.financialHigh)}, sehr hoch ab {formatEuro(settings.scheme.financialVeryHigh)},
                  Ausfall {formatHours(settings.scheme.availabilityHighHours)} / {formatHours(settings.scheme.availabilityVeryHighHours)}.
                  Ersetzt Organisation, Bewertungsschema und Maßnahmen dieses Browsers. Bestehende Analysen behalten ihr Schema.
                </span>
              </span>
            </label>
          )}

          {records.length > 0 && (
            <div>
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-[4px] size-3.5 accent-primary-950"
                  checked={takeAssets}
                  onChange={(e) => setTakeAssets(e.target.checked)}
                />
                <span>
                  {records.length} {records.length === 1 ? "Analyse" : "Analysen"} mit {versions}{" "}
                  {versions === 1 ? "Version" : "Versionen"} und Änderungsprotokoll übernehmen
                </span>
              </label>
              <ul className="mt-2 ml-6 max-h-44 divide-y divide-line overflow-y-auto border-y border-line text-[13px]">
                {records.map((r) => {
                  const last = r.versions[r.versions.length - 1];
                  return (
                    <li key={r.asset.id} className="flex items-center justify-between gap-3 py-1.5">
                      <span className="truncate">{last?.meta.name || "Unbenannt"}</span>
                      <span className="text-muted tabular">
                        {r.versions.length} {r.versions.length === 1 ? "Version" : "Versionen"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {!settings && records.length === 0 && <p className="text-muted">Die Datei enthält keine Einstellungen und keine Analysen.</p>}
        </div>
      )}
    </Dialog>
  );
}
