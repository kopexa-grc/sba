import { useState, type ReactNode } from "react";
import { LevelBars, LevelMark, ResultSummary, TriadMarks } from "../components/level";
import { StatusText } from "../components/StatusBadge";
import { Button, Empty, Field, Input, Meta, Notice, Segmented, Select, Textarea, cn } from "../components/ui";
import type { GoalResult } from "../domain/scoring";
import type { Goal } from "../domain/types";

const PRIMARY = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

function Block({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-line pt-8">
      <div>
        <h2 className="text-[17px] font-semibold">{title}</h2>
        {note && <p className="mt-0.5 max-w-2xl text-[13.5px] text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** Side-by-side: the pattern we use and the generic one we reject. */
function DoDont({ good, bad, why }: { good: ReactNode; bad: ReactNode; why: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <div className="mb-2 text-[12.5px] text-muted">So</div>
        <div className="rounded-lg border border-line p-4">{good}</div>
      </div>
      <div>
        <div className="mb-2 text-[12.5px] text-muted">Nicht so – {why}</div>
        <div className="rounded-lg border border-line p-4 opacity-70">{bad}</div>
      </div>
    </div>
  );
}

function sample(levels: Record<Goal, 1 | 2 | 3 | null>, complete = true): Record<Goal, GoalResult> {
  const r = (goal: Goal): GoalResult => ({
    goal,
    computed: levels[goal],
    effective: levels[goal],
    complete,
    answered: complete ? 6 : 3,
    total: 6,
    drivers: [],
    override: null,
  });
  return { C: r("C"), I: r("I"), A: r("A") };
}

/** Living reference for docs/STYLEGUIDE.md. */
export function Styleguide() {
  const [yes, setYes] = useState<boolean | null>(true);
  const [picked, setPicked] = useState<1 | 2 | 3>(2);
  return (
    <div className="mx-auto grid max-w-[1100px] gap-10 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-[24px] font-semibold">Styleguide</h1>
        <p className="mt-1 max-w-2xl text-[14px] text-muted">
          Ruhig, präzise, dicht. Struktur aus Weißraum und Linien, Farbe nur auf Daten. Regeln und Begründungen in
          docs/STYLEGUIDE.md.
        </p>
      </header>

      <Block title="Farben" note="Kopexa Navy für Marke und die eine Primäraktion. Die Ampel ist für den Schutzbedarf reserviert.">
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
          {PRIMARY.map((s) => (
            <div key={s} className="grid gap-1 text-[11.5px] text-muted">
              <span className="h-9 rounded-md border border-line" style={{ background: `var(--color-primary-${s})` }} />
              {s}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12.5px]">
          {[
            ["ink", "ink – Text"],
            ["muted", "muted – Sekundärtext"],
            ["line", "line – Linien"],
            ["surface", "surface – Hover, aktiv"],
            ["lvl-1", "Normal"],
            ["lvl-2", "Hoch"],
            ["lvl-3", "Sehr hoch"],
          ].map(([t, l]) => (
            <span key={t} className="flex items-center gap-2">
              <span className="size-4 rounded-[4px] border border-line" style={{ background: `var(--color-${t})` }} />
              {l}
            </span>
          ))}
        </div>
      </Block>

      <Block title="Typografie" note="Public Sans für alles, Schibsted Grotesk nur für H1 und Ergebniswerte. Keine Versalien.">
        <div className="grid gap-2">
          <div className="font-display text-[24px] font-semibold">Seitentitel 24</div>
          <div className="text-[17px] font-semibold">Abschnitt 17</div>
          <div className="text-[14px] font-semibold">Unterabschnitt 14</div>
          <div className="text-[14px]">Fließtext 14 / 1.55</div>
          <div className="text-[12.5px] text-muted">Metazeile 12.5, muted</div>
        </div>
      </Block>

      <Block title="Schutzbedarf" note="Drei Balken tragen die Farbe, das Wort bleibt in ink. In Tabellen und Navigation nur die Balken.">
        <DoDont
          why="Pastell-Pills mit Punkt"
          good={
            <div className="flex flex-wrap items-center gap-5">
              <LevelMark level={1} />
              <LevelMark level={2} />
              <LevelMark level={3} />
              <LevelMark level={null} />
              <TriadMarks results={sample({ C: 3, I: 2, A: 1 })} />
            </div>
          }
          bad={
            <div className="flex flex-wrap gap-2">
              {[
                ["Normal", "bg-emerald-50 text-emerald-800 ring-emerald-200", "bg-emerald-500"],
                ["Hoch", "bg-amber-50 text-amber-800 ring-amber-200", "bg-amber-500"],
                ["Sehr hoch", "bg-red-50 text-red-800 ring-red-200", "bg-red-500"],
              ].map(([l, c, d]) => (
                <span key={l} className={cn("inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11.5px] font-semibold ring-1", c)}>
                  <span className={cn("size-1.5 rounded-full", d)} />
                  {l}
                </span>
              ))}
            </div>
          }
        />
      </Block>

      <Block title="Auswahl der Schadensstufe" note="Ausgewählt: Rahmen in Navy und Fläche surface. Kein Farbstreifen.">
        <DoDont
          why="farbiger Rand links"
          good={
            <div className="grid gap-1.5">
              {([1, 2, 3] as const).map((l) => (
                <label
                  key={l}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-[13.5px]",
                    picked === l ? "border-primary-950 bg-surface" : "border-line hover:bg-surface",
                  )}
                >
                  <input type="radio" className="size-3.5 accent-primary-950" checked={picked === l} onChange={() => setPicked(l)} />
                  <span className="flex-1">{["geringfügige", "erhebliche", "fundamentale"][l - 1]} Auswirkungen</span>
                  <LevelBars level={l} />
                </label>
              ))}
            </div>
          }
          bad={
            <div className="grid gap-1.5">
              {(["bg-emerald-500", "bg-amber-500", "bg-red-500"] as const).map((c, i) => (
                <div key={c} className="relative overflow-hidden rounded-md border border-line py-2 pr-3 pl-4 text-[13.5px]">
                  <span className={cn("absolute inset-y-0 left-0 w-1", c)} />
                  {["geringfügige", "erhebliche", "fundamentale"][i]} Auswirkungen
                </div>
              ))}
            </div>
          }
        />
      </Block>

      <Block title="Ergebnis" note="Ablesewerte statt Kacheln, getrennt durch Linien.">
        <div className="grid gap-8 md:grid-cols-2">
          <ResultSummary results={sample({ C: 3, I: 2, A: 1 })} />
          <ResultSummary results={sample({ C: 2, I: null, A: 1 }, false)} />
        </div>
      </Block>

      <Block title="Hinweise" note="Icon in Signalfarbe, Text in ink, keine Fläche.">
        <DoDont
          why="eingefärbte Boxen"
          good={
            <div className="grid gap-2">
              <Notice tone="error">Integrität: Begründung für „Hoch“ fehlt.</Notice>
              <Notice tone="warning">Besondere Kategorien nach Art. 9 DSGVO sind meist mindestens „Hoch“.</Notice>
              <Notice>Die Übernahme startet als Entwurf.</Notice>
            </div>
          }
          bad={
            <div className="grid gap-2 text-[13px]">
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800">Integrität: Begründung fehlt!</div>
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">Achtung: Art. 9 DSGVO</div>
            </div>
          }
        />
      </Block>

      <Block title="Metadaten und Status" note="Eine Textzeile mit Mittelpunkten. Gesperrte Status mit Schloss.">
        <DoDont
          why="Badge-Reihe"
          good={
            <div className="grid gap-2">
              <Meta items={["Version 1.1", <StatusText key="d" status="draft" />, "Anwendung", "Owner Vertrieb"]} />
              <Meta items={["Version 1.0", <StatusText key="a" status="final" />, "Anwendung"]} />
            </div>
          }
          bad={
            <div className="flex flex-wrap gap-1.5 text-[11.5px] font-medium">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 ring-1 ring-slate-200">v1.1-dev</span>
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-800 ring-1 ring-blue-200">Entwurf</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 ring-1 ring-slate-200">Anwendung</span>
            </div>
          }
        />
      </Block>

      <Block title="Buttons" note="Eine Primäraktion pro Ansicht. Icons nur mit Bedeutung.">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">Version abschließen</Button>
          <Button>Export</Button>
          <Button variant="ghost">Zurück</Button>
          <Button variant="danger">Endgültig löschen</Button>
          <Button variant="primary" disabled>
            Speichern
          </Button>
          <Button size="sm">Klein</Button>
        </div>
      </Block>

      <Block title="Formulare" note="Label darüber, Pflicht als Text, Fokus als Navy-Rahmen ohne Glow.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Asset-Bezeichnung" required hint="Wie im Asset-Register.">
            {(id) => <Input id={id} placeholder="z. B. Kunden-CRM" />}
          </Field>
          <Field label="Asset-Typ">
            {(id) => (
              <Select id={id}>
                <option>Anwendung</option>
              </Select>
            )}
          </Field>
          <Field label="Erläuterung" required error="Bei Hoch und Sehr hoch erforderlich.">
            {(id) => <Textarea id={id} aria-invalid rows={2} />}
          </Field>
          <Field label="Vorfrage">
            {() => (
              <Segmented
                label="Vorfrage"
                value={yes}
                onChange={setYes}
                options={[
                  { value: true, label: "Ja" },
                  { value: false, label: "Nein" },
                ]}
              />
            )}
          </Field>
        </div>
      </Block>

      <Block title="Leerzustand" note="Linksbündig, ein Satz, eine Aktion.">
        <DoDont
          why="zentriert, gestrichelt"
          good={
            <Empty title="Noch keine Analysen" action={<Button variant="primary">Analyse anlegen</Button>}>
              Legen Sie eine Analyse an oder übernehmen Sie einen Excel-Bogen.
            </Empty>
          }
          bad={
            <div className="flex flex-col items-center rounded-lg border-2 border-dashed border-slate-300 px-6 py-8 text-center">
              <div className="mb-2 size-8 rounded-full bg-slate-100" />
              <div className="font-semibold">Noch keine Analysen</div>
              <div className="text-[13px] text-slate-500">Starten Sie jetzt mit Ihrer ersten Analyse!</div>
            </div>
          }
        />
      </Block>
    </div>
  );
}
