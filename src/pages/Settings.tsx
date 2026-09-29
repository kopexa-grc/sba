import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useSettings } from "../app/data";
import { useFileActions } from "../app/file-actions";
import { useSession } from "../app/session";
import { LevelBars } from "../components/level";
import { Button, Dialog, Field, Input, Notice, Textarea, cn } from "../components/ui";
import { db } from "../db/db";
import { repo } from "../db/repo";
import {
  DEFAULT_MEASURES,
  DEFAULT_SCHEME,
  catalogFor,
  formatEuro,
  formatHours,
  schemeErrors,
  snapshotOf,
  type Settings,
} from "../domain/scheme";
import { GOALS, GOAL_EN, GOAL_LABEL } from "../domain/types";
import { SCHEMA_VERSION } from "../io/json";
import { usePageTitle } from "../lib/a11y";
import { formatDate } from "../lib/format";

function Block({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-4 border-t border-line pt-8 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
      </div>
      <div className="grid min-w-0 gap-4">{children}</div>
    </section>
  );
}

/** Scales an uploaded image to a PNG data URL (max 480 px wide) for reports. */
async function toLogo(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 480 / img.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function NumberField({
  label,
  value,
  onChange,
  unit,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  unit: string;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            min={0}
            value={Number.isFinite(value) ? value : ""}
            onChange={(e) => onChange(e.target.valueAsNumber)}
            className="max-w-44 tabular"
          />
          <span className="text-[13.5px] text-muted">{unit}</span>
        </div>
      )}
    </Field>
  );
}

export function SettingsPage() {
  usePageTitle("Einstellungen");
  const files = useFileActions();
  const stored = useSettings();
  const { identity, editIdentity, notify, guard } = useSession();
  const [draft, setDraft] = useState<Settings | null>(null);
  const [wipe, setWipe] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const storage = useLiveQuery(async () => ({
    est: await navigator.storage?.estimate?.(),
    persisted: await navigator.storage?.persisted?.(),
    lastBackup: await repo.lastBackupAt(),
  }));

  // Take over stored settings on load and whenever they change underneath (e.g. a file was opened).
  const storedJson = stored ? JSON.stringify(stored) : null;
  const [baseline, setBaseline] = useState<string | null>(null);
  useEffect(() => {
    if (!stored || storedJson === baseline) return;
    const untouched = !draft || JSON.stringify(draft) === baseline;
    setBaseline(storedJson);
    if (untouched) setDraft(structuredClone(stored));
  }, [stored, storedJson, baseline, draft]);

  const dirty = useMemo(() => !!stored && !!draft && JSON.stringify(stored) !== JSON.stringify(draft), [stored, draft]);
  if (!stored || !draft) return null;

  const errors = schemeErrors(draft.scheme);
  const preview = catalogFor(snapshotOf(draft.scheme));
  // Applied immediately (not as a state updater): callers read input events, which are only valid during the handler.
  const set = (fn: (s: Settings) => void) => {
    const next = structuredClone(draft!);
    fn(next);
    setDraft(next);
  };

  async function save() {
    const clean = structuredClone(draft!);
    for (const g of GOALS) for (const l of [2, 3] as const) clean.measures[g][l] = clean.measures[g][l].map((m) => m.trim()).filter(Boolean);
    clean.organization.name = clean.organization.name.trim();
    clean.preparedBy.name = clean.preparedBy.name.trim();
    clean.scheme.name = clean.scheme.name.trim() || DEFAULT_SCHEME.name;
    const saved = await guard(() => repo.saveSettings(clean));
    if (!saved) return;
    setDraft(structuredClone(saved));
    notify(
      saved.scheme.revision !== stored!.scheme.revision
        ? `Gespeichert. Neue Analysen und Versionen verwenden Schema-Stand ${saved.scheme.revision}.`
        : "Gespeichert.",
    );
  }

  const fin = preview.I.scenarios.find((s) => s.id === "financial")!;
  const ops = preview.A.scenarios.find((s) => s.id === "operations")!;

  return (
    <div className="mx-auto grid max-w-[1000px] gap-8 px-4 py-8 pb-28 sm:px-6">
      <div>
        <h1 className="text-[24px] font-semibold">Einstellungen</h1>
        <p className="mt-1 text-[14px] text-muted">Gelten für diesen Browser. Als Datei lassen sie sich speichern und an Kolleg:innen weitergeben.</p>
      </div>

      <Block title="Organisation" description="Erscheint im Kopf von PDF-Bericht und Excel-Prüfbericht.">
        <Field label="Name der Organisation">
          {(id) => (
            <Input
              id={id}
              value={draft.organization.name}
              placeholder="z. B. Musterstadtwerke GmbH"
              onChange={(e) => set((s) => void (s.organization.name = e.target.value))}
            />
          )}
        </Field>
        <div>
          <div className="mb-1.5 text-[13px] font-medium">Logo</div>
          <div className="flex flex-wrap items-center gap-3">
            {draft.organization.logo && (
              <img src={draft.organization.logo} alt="Logo" className="h-10 max-w-40 rounded border border-line object-contain p-1" />
            )}
            <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-line px-3 text-[13.5px] font-medium hover:bg-surface">
              {draft.organization.logo ? "Anderes Logo wählen" : "Logo wählen"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  const logo = await guard(() => toLogo(f));
                  if (logo) set((s) => void (s.organization.logo = logo));
                }}
              />
            </label>
            {draft.organization.logo && (
              <Button variant="ghost" onClick={() => set((s) => void (s.organization.logo = null))}>
                Entfernen
              </Button>
            )}
          </div>
        </div>
      </Block>

      <Block
        title="Erstellt durch"
        description={
          <>
            Optional, etwa für Beratungen: erscheint in PDF- und Tabellenberichten neben der Organisation.{" "}
            <Link to="/hilfe#berater" className="underline underline-offset-2">
              Hinweise für Berater
            </Link>
          </>
        }
      >
        <Field label="Name (z. B. Beratungsunternehmen)">
          {(id) => (
            <Input
              id={id}
              value={draft.preparedBy.name}
              placeholder="z. B. Muster Consulting GmbH"
              onChange={(e) => set((s) => void (s.preparedBy.name = e.target.value))}
            />
          )}
        </Field>
        <div>
          <div className="mb-1.5 text-[13px] font-medium">Logo</div>
          <div className="flex flex-wrap items-center gap-3">
            {draft.preparedBy.logo && (
              <img src={draft.preparedBy.logo} alt="Logo „Erstellt durch“" className="h-10 max-w-40 rounded border border-line object-contain p-1" />
            )}
            <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-line px-3 text-[13.5px] font-medium hover:bg-surface">
              {draft.preparedBy.logo ? "Anderes Logo wählen" : "Logo wählen"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  const logo = await guard(() => toLogo(f));
                  if (logo) set((s) => void (s.preparedBy.logo = logo));
                }}
              />
            </label>
            {draft.preparedBy.logo && (
              <Button variant="ghost" onClick={() => set((s) => void (s.preparedBy.logo = null))}>
                Entfernen
              </Button>
            )}
          </div>
        </div>
      </Block>

      <Block
        title="Bewertungsschema"
        description={
          <>
            Nach BSI 200-2 legt jede Organisation fest, ab wann ein Schaden hoch ist. Gilt für neue Analysen und neue Versionen;
            bestehende Versionen behalten ihr Schema. Aktueller Stand: {stored.scheme.revision}.
          </>
        }
      >
        <Field label="Bezeichnung">
          {(id) => <Input id={id} value={draft.scheme.name} onChange={(e) => set((s) => void (s.scheme.name = e.target.value))} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Finanzieller Schaden „Hoch“ ab"
            unit="€"
            value={draft.scheme.financialHigh}
            onChange={(n) => set((s) => void (s.scheme.financialHigh = n))}
          />
          <NumberField
            label="Finanzieller Schaden „Sehr hoch“ ab"
            unit="€"
            value={draft.scheme.financialVeryHigh}
            onChange={(n) => set((s) => void (s.scheme.financialVeryHigh = n))}
          />
          <NumberField
            label="Tolerierbarer Ausfall bei „Hoch“ bis"
            unit="Stunden"
            value={draft.scheme.availabilityHighHours}
            onChange={(n) => set((s) => void (s.scheme.availabilityHighHours = n))}
            hint="Längere tolerierbare Ausfälle gelten als Normal."
          />
          <NumberField
            label="Tolerierbarer Ausfall bei „Sehr hoch“ bis"
            unit="Stunden"
            value={draft.scheme.availabilityVeryHighHours}
            onChange={(n) => set((s) => void (s.scheme.availabilityVeryHighHours = n))}
          />
        </div>
        {errors.map((e) => (
          <Notice key={e} tone="error">
            {e}
          </Notice>
        ))}
        {errors.length === 0 && (
          <div>
            <div className="mb-1.5 text-[13px] text-muted">So lauten die Antwortoptionen im Fragebogen</div>
            <ul className="divide-y divide-line border-y border-line text-[13.5px]">
              {[...fin.options, ...ops.options].map((o, i) => (
                <li key={i} className="flex items-start justify-between gap-4 py-2">
                  <span>{o.text}</span>
                  <LevelBars level={o.level} className="mt-1 shrink-0" />
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <Button
            variant="ghost"
            className="h-auto min-h-8 py-1.5 text-left whitespace-normal"
            onClick={() =>
              set((s) => {
                s.scheme = { ...s.scheme, ...DEFAULT_SCHEME, revision: s.scheme.revision, updatedAt: s.scheme.updatedAt };
              })
            }
          >
            Standardwerte ({formatEuro(DEFAULT_SCHEME.financialHigh)} / {formatEuro(DEFAULT_SCHEME.financialVeryHigh)},{" "}
            {formatHours(DEFAULT_SCHEME.availabilityHighHours)} / {formatHours(DEFAULT_SCHEME.availabilityVeryHighHours)})
          </Button>
        </div>
      </Block>

      <Block title="Maßnahmen" description="Vorschläge im Ergebnis und im Bericht, je Grundwert und Stufe. Eine Maßnahme pro Zeile.">
        {GOALS.map((g) => (
          <div key={g} className="grid gap-3">
            <h3 className="text-[14px] font-semibold">
              {GOAL_LABEL[g]} <span lang="en" className="font-normal text-muted">({GOAL_EN[g]})</span>
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {([2, 3] as const).map((l) => (
                <Field key={l} label={l === 2 ? "Bei Hoch" : "Zusätzlich bei Sehr hoch"}>
                  {(id) => (
                    <Textarea
                      id={id}
                      rows={4}
                      value={draft.measures[g][l].join("\n")}
                      onChange={(e) =>
                        set((s) => {
                          s.measures[g][l] = e.target.value.split("\n");
                        })
                      }
                    />
                  )}
                </Field>
              ))}
            </div>
          </div>
        ))}
        <div>
          <Button
            variant="ghost"
            className="h-auto min-h-8 py-1.5 text-left whitespace-normal"
            onClick={() => set((s) => void (s.measures = structuredClone(DEFAULT_MEASURES)))}
          >
            Standardmaßnahmen wiederherstellen
          </Button>
        </div>
      </Block>

      <Block title="Ihre Angaben" description="Name im Änderungsprotokoll und im Bericht. Wird nicht geteilt.">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[14px]">
          <span>
            {identity?.name}
            {identity?.email && <span className="text-muted"> · {identity.email}</span>}
          </span>
          <Button onClick={editIdentity}>Ändern</Button>
        </div>
      </Block>

      <Block
        title="Speichern und öffnen"
        description={
          <>
            Das Dateiformat der App (.sba, Format {SCHEMA_VERSION}) – für einzelne Analysen, alle Analysen oder die Einstellungen.
            Beim Öffnen wählen Sie, was übernommen wird. Ältere .sba.json-Dateien lassen sich ebenfalls öffnen.
          </>
        }
      >
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[14px]">
              Alles speichern
              <div className="text-[13px] text-muted">
                Einstellungen und alle Analysen in einer Datei.
                {storage?.lastBackup ? ` Zuletzt am ${formatDate(storage.lastBackup)}.` : " Noch nicht gespeichert."}
              </div>
            </div>
            <Button onClick={files.saveAll}>Alles speichern</Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <div className="text-[14px]">
              Einstellungen weitergeben
              <div className="text-[13px] text-muted">Organisation, Bewertungsschema und Maßnahmen – ohne Analysen.</div>
            </div>
            <Button onClick={files.saveSettings}>Einstellungen als Datei speichern</Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <div className="text-[14px]">
              Datei öffnen
              <div className="text-[13px] text-muted">Gespeicherte Analysen oder weitergegebene Einstellungen (.sba).</div>
            </div>
            <Button onClick={files.openFile}>Datei öffnen</Button>
          </div>
        </div>
      </Block>

      <Block title="Speicher" description="Alles liegt in diesem Browser. Beim Löschen der Browserdaten gehen die Analysen verloren.">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[14px]">
          <span>
            {storage?.est?.usage !== undefined ? `${(storage.est.usage / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB belegt` : "–"}
            <span className="text-muted">
              {" "}
              · {storage?.persisted ? "dauerhaft gespeichert" : "Browser darf bei Speichermangel löschen"}
            </span>
          </span>
          {!storage?.persisted && (
            <Button
              onClick={async () => {
                const ok = await navigator.storage?.persist?.();
                notify(ok ? "Speicher ist jetzt dauerhaft." : "Der Browser lehnt dauerhaften Speicher ab. Installieren Sie die App oder speichern Sie regelmäßig.");
              }}
            >
              Dauerhaft speichern
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-[14px]">
          <span>Alle Analysen und Einstellungen aus diesem Browser entfernen.</span>
          <Button variant="danger" onClick={() => setWipe(true)}>
            Alles löschen …
          </Button>
        </div>
        <p className="text-[13px] text-muted">
          Methodik nach BSI-Standard 200-2 und ISO/IEC 27001 ·{" "}
          <Link to="/styleguide" className="text-primary-700 underline underline-offset-2">
            Styleguide
          </Link>
        </p>
      </Block>

      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur-sm transition-transform duration-150",
          dirty ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="mx-auto flex max-w-[1000px] items-center justify-end gap-2 px-4 py-3 sm:px-6">
          <span className="mr-auto text-[13px] text-muted">Ungespeicherte Änderungen</span>
          <Button onClick={() => setDraft(structuredClone(stored))}>Verwerfen</Button>
          <Button variant="primary" disabled={errors.length > 0} onClick={save}>
            Speichern
          </Button>
        </div>
      </div>


      <Dialog
        open={wipe}
        onClose={() => setWipe(false)}
        title="Alles löschen?"
        description="Sämtliche Analysen, Versionen, Änderungsprotokolle und Einstellungen werden unwiderruflich entfernt. Speichern Sie vorher alles als Datei."
        footer={
          <>
            <Button onClick={() => setWipe(false)}>Abbrechen</Button>
            <Button
              variant="danger"
              disabled={confirmText !== "LÖSCHEN"}
              onClick={async () => {
                await guard(() =>
                  db.transaction("rw", db.assets, db.versions, db.audit, db.settings, async () => {
                    await Promise.all([db.assets.clear(), db.versions.clear(), db.audit.clear()]);
                    await db.settings.bulkDelete(["settings", "lastBackupAt"]);
                  }),
                );
                setWipe(false);
                setConfirmText("");
                setDraft(null);
                notify("Alle Daten wurden gelöscht.");
              }}
            >
              Endgültig löschen
            </Button>
          </>
        }
      >
        <Field label="Zur Bestätigung LÖSCHEN eingeben">
          {(id) => <Input id={id} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />}
        </Field>
      </Dialog>
    </div>
  );
}
