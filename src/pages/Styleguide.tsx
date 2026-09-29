import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { LevelGauge, LevelPill, Seal, TriadChips } from "../components/level";
import { StatusBadge } from "../components/StatusBadge";
import { Badge, Button, Card, Empty, Field, Input, Segmented, Select, Textarea } from "../components/ui";
import type { GoalResult } from "../domain/scoring";
import type { Goal } from "../domain/types";

const PRIMARY = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

function Block({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 border-t border-line pt-6">
      <div>
        <h2 className="text-[17px] font-bold">{title}</h2>
        {note && <p className="text-[13px] text-muted">{note}</p>}
      </div>
      {children}
    </section>
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

/** Living reference for the Kopexa look (see docs/STYLEGUIDE.md). */
export function Styleguide() {
  const [yes, setYes] = useState<boolean | null>(true);
  return (
    <div className="mx-auto grid max-w-[1100px] gap-6 px-4 py-8">
      <header>
        <h1 className="text-[28px] font-bold">Styleguide</h1>
        <p className="text-[14px] text-muted">
          Tokens und Komponenten der Kopexa Schutzbedarfsanalyse. Abgeleitet vom Kopexa-Sight-Theme; neue Komponenten
          verwenden ausschließlich diese Tokens.
        </p>
      </header>

      <Block title="Farben" note="Kopexa Navy (primary-950) trägt Marke und Primäraktionen. Ampelfarben nur für Schutzbedarf.">
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
          {PRIMARY.map((s) => (
            <div key={s} className="grid gap-1 text-[11px] text-muted">
              <span className="h-10 rounded-md ring-1 ring-line ring-inset" style={{ background: `var(--color-primary-${s})` }} />
              primary-{s}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {[
            ["lvl-1", "Normal #10B981"],
            ["lvl-2", "Hoch #F59E0B"],
            ["lvl-3", "Sehr hoch #EF4444"],
            ["lvl-open", "offen"],
            ["ink", "ink"],
            ["muted", "muted"],
            ["line", "line"],
            ["surface", "surface"],
          ].map(([t, l]) => (
            <div key={t} className="flex items-center gap-2 text-[12px]">
              <span className="size-6 rounded-md ring-1 ring-line ring-inset" style={{ background: `var(--color-${t})` }} />
              {l}
            </div>
          ))}
        </div>
      </Block>

      <Block title="Typografie" note="Schibsted Grotesk für Überschriften und Kennzahlen, Public Sans für Fließtext und UI. Beide lokal gebündelt (offline).">
        <div className="grid gap-2">
          <div className="font-display text-[28px] font-bold">Seitentitel 28 / bold</div>
          <div className="font-display text-[21px] font-bold">Abschnitt 21 / bold</div>
          <div className="font-display text-[15px] font-semibold">Kartentitel 15 / semibold</div>
          <div className="text-[14px]">Fließtext 14 / 1.5 – Public Sans</div>
          <div className="text-[12.5px] text-muted">Hilfstext 12.5 / muted</div>
          <div className="text-[11.5px] font-semibold tracking-wide text-muted uppercase">Tabellenkopf 11.5 / caps</div>
        </div>
      </Block>

      <Block title="Buttons" note="Genau eine Primäraktion pro Bereich. Radius 6 px, Höhe 34 px (sm 28 px).">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon={<Plus className="size-4" />}>
            Neue Analyse
          </Button>
          <Button>Sekundär</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Löschen</Button>
          <Button variant="primary" disabled>
            Deaktiviert
          </Button>
          <Button size="sm">Klein</Button>
        </div>
      </Block>

      <Block title="Formulare">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Eingabe" required hint="Hilfstext unter dem Feld">
            {(id) => <Input id={id} placeholder="Platzhalter" />}
          </Field>
          <Field label="Auswahl">
            {(id) => (
              <Select id={id}>
                <option>Anwendung</option>
              </Select>
            )}
          </Field>
          <Field label="Mehrzeilig" error="Pflicht bei „Hoch“ und „Sehr hoch“.">
            {(id) => <Textarea id={id} />}
          </Field>
          <Field label="Ja / Nein">
            {() => (
              <Segmented
                label="Ja/Nein"
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

      <Block title="Schutzbedarf" note="Pill für Texte und Listen, Gauge für Optionen, Triade für Übersichten.">
        <div className="flex flex-wrap items-center gap-3">
          <LevelPill level={1} />
          <LevelPill level={2} />
          <LevelPill level={3} />
          <LevelPill level={null} />
          <LevelGauge level={1} />
          <LevelGauge level={2} />
          <LevelGauge level={3} />
          <TriadChips results={sample({ C: 3, I: 2, A: 1 })} />
          <TriadChips results={sample({ C: 1, I: null, A: 2 }, false)} />
        </div>
      </Block>

      <Block title="Status">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="draft" />
          <StatusBadge status="review" />
          <StatusBadge status="approved" />
          <StatusBadge status="archived" />
          <Badge tone="neutral">v1.1-dev</Badge>
          <Badge tone="navy">Navy</Badge>
        </div>
      </Block>

      <Block title="Siegel" note="Signaturelement: Live-Ergebnis, nach Freigabe mit SHA-256 versiegelt.">
        <div className="grid gap-4 md:grid-cols-3">
          <Seal results={sample({ C: 2, I: null, A: 1 }, false)} integrity="unsealed" hash={null} />
          <Seal results={sample({ C: 3, I: 2, A: 1 })} integrity="valid" hash={"3f9a".padEnd(64, "0c21e")} />
          <Seal results={sample({ C: 3, I: 2, A: 1 })} integrity="tampered" hash={"3f9a".padEnd(64, "0c21e")} />
        </div>
      </Block>

      <Block title="Container">
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="p-4 text-[13px]">Karte: weißer Grund, 1 px Linie, Radius 8 px, kein Schatten.</Card>
          <Empty title="Leerer Zustand">Erklärt, was zu tun ist – mit genau einer naheliegenden Aktion.</Empty>
        </div>
      </Block>
    </div>
  );
}
