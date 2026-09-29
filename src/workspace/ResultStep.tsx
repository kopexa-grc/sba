import { AlertTriangle, CheckCircle2, CircleAlert, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { LevelPill } from "../components/level";
import { Field, Select, cn } from "../components/ui";
import { SCENARIO_SHORT } from "../domain/catalog";
import { MEASURES } from "../domain/measures";
import { goalResult, validate, type Issue } from "../domain/scoring";
import { GOALS, GOAL_LABEL, LEVEL_LABEL, OVERRIDE_KIND_LABEL, type Goal, type OverrideKind } from "../domain/types";
import { CommitInput, useEditor } from "./editor";

export function ResultStep({ basePath }: { basePath: string }) {
  const { version } = useEditor();
  const issues = validate(version);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div>
        <h2 className="text-[21px] font-bold">Konsolidierung &amp; Begründung</h2>
        <p className="mt-0.5 text-[13.5px] text-muted">
          Maximumprinzip je Grundwert, danach Prüfung von Kumulations-, Verteilungs- und Vererbungseffekten.
        </p>
      </div>
      {GOALS.map((g) => (
        <GoalPanel key={g} goal={g} basePath={basePath} />
      ))}
      <IssueList issues={issues} basePath={basePath} />
    </div>
  );
}

function GoalPanel({ goal, basePath }: { goal: Goal; basePath: string }) {
  const { version, readOnly, update } = useEditor();
  const r = goalResult(version, goal);
  const override = version.overrides[goal];
  const needsJustification = r.effective !== null && r.effective >= 2;

  return (
    <section className="rounded-lg border border-line bg-paper">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3">
        <h3 className="text-[16px] font-semibold">{GOAL_LABEL[goal]}</h3>
        <div className="flex items-center gap-2 text-[12.5px] text-muted">
          Maximum <LevelPill level={r.computed} />
          {override && (
            <>
              → übersteuert <LevelPill level={override.level} />
            </>
          )}
        </div>
        {!r.complete && (
          <Link to={`${basePath}/${goal}`} className="ml-auto text-[12.5px] font-medium text-primary-700 hover:underline">
            {r.total - r.answered} Szenarien offen →
          </Link>
        )}
      </header>

      <div className="grid gap-4 px-4 py-4">
        {r.computed !== null && r.computed > 1 && (
          <p className="text-[13px] text-muted">
            Bestimmt durch:{" "}
            {r.drivers.map((d, i) => (
              <span key={d}>
                {i > 0 && ", "}
                <Link className="font-medium text-ink hover:underline" to={`${basePath}/${goal}#${goal}.${d}`}>
                  {SCENARIO_SHORT[d]}
                </Link>
              </span>
            ))}
          </p>
        )}

        <div className="rounded-md border border-line bg-surface/60 p-3">
          <label className="flex items-center gap-2 text-[13.5px] font-medium">
            <input
              type="checkbox"
              className="size-3.5 accent-primary-950"
              checked={!!override}
              disabled={readOnly || r.computed === null}
              onChange={(e) =>
                update((v) => {
                  v.overrides[goal] = e.target.checked
                    ? { level: r.computed ?? 1, kind: "cumulation", reason: "" }
                    : null;
                })
              }
            />
            Sondereffekt berücksichtigen (manuelle Übersteuerung)
          </label>
          <p className="mt-1 pl-5.5 text-[12.5px] text-muted">
            Kumulation kann hochstufen, Verteilung (Redundanz) herabstufen, Vererbung übernimmt den Schutzbedarf abhängiger
            Prozesse oder Anwendungen.
          </p>
          {override && (
            <div className="mt-3 grid gap-3 pl-5.5 md:grid-cols-[1fr_2fr]">
              <Field label="Effekt">
                {(id) => (
                  <Select
                    id={id}
                    value={override.kind}
                    disabled={readOnly}
                    onChange={(e) =>
                      update((v) => {
                        v.overrides[goal] = { ...override, kind: e.target.value as OverrideKind };
                      })
                    }
                  >
                    {(Object.keys(OVERRIDE_KIND_LABEL) as OverrideKind[]).map((k) => (
                      <option key={k} value={k}>
                        {OVERRIDE_KIND_LABEL[k]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Schutzbedarf nach Übersteuerung">
                {(id) => (
                  <Select
                    id={id}
                    value={override.level}
                    disabled={readOnly}
                    onChange={(e) =>
                      update((v) => {
                        v.overrides[goal] = { ...override, level: Number(e.target.value) as 1 | 2 | 3 };
                      })
                    }
                  >
                    {([1, 2, 3] as const).map((l) => (
                      <option key={l} value={l}>
                        {LEVEL_LABEL[l]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Begründung der Übersteuerung" required className="md:col-span-2">
                {(id) => (
                  <CommitInput
                    id={id}
                    multiline
                    rows={2}
                    value={override.reason}
                    placeholder="z. B. „Server hostet die Anwendung ‚Kunden-CRM‘ (Vertraulichkeit sehr hoch) – Vererbung nach Maximumprinzip.“"
                    onCommit={(reason) =>
                      update((v) => {
                        v.overrides[goal] = { ...v.overrides[goal]!, reason };
                      })
                    }
                  />
                )}
              </Field>
            </div>
          )}
        </div>

        <Field
          label={`Begründung Schutzbedarf ${GOAL_LABEL[goal]}`}
          required={needsJustification}
          hint={needsJustification ? "Pflichtfeld bei „Hoch“ und „Sehr hoch“." : "Optional bei „Normal“."}
        >
          {(id) => (
            <CommitInput
              id={id}
              multiline
              rows={3}
              value={version.justifications[goal]}
              placeholder="Zusammenfassende Begründung für das Deckblatt"
              onCommit={(val) =>
                update((v) => {
                  v.justifications[goal] = val;
                })
              }
            />
          )}
        </Field>

        {r.effective !== null && r.effective >= 2 && (
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-muted">
              <ShieldCheck className="size-3.5" /> Typische Maßnahmen bei Schutzbedarf „{LEVEL_LABEL[r.effective]}“
            </div>
            <ul className="grid gap-1 text-[13px] md:grid-cols-2">
              {(r.effective === 3 ? [...MEASURES[goal][2], ...MEASURES[goal][3]] : MEASURES[goal][2]).map((m) => (
                <li key={m} className="flex gap-2 rounded-md bg-surface px-2.5 py-1.5">
                  <span className="mt-[7px] size-1 shrink-0 rounded-full bg-muted" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export function issueHref(basePath: string, path: string): string {
  if (path.startsWith("meta.")) return `${basePath}/stammdaten`;
  const [head] = path.split(".");
  if (head === "C" || head === "I" || head === "A") return `${basePath}/${head}#${path}`;
  return `${basePath}/ergebnis`;
}

export function IssueList({ issues, basePath, compact }: { issues: Issue[]; basePath: string; compact?: boolean }) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800">
        <CheckCircle2 className="size-4 shrink-0" /> Plausibilitätsprüfung bestanden – bereit zur Prüfung.
      </div>
    );
  }
  const shown = compact ? [...errors, ...warnings].slice(0, 5) : [...errors, ...warnings];
  return (
    <section className="rounded-lg border border-line bg-paper">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2 text-[12.5px] font-semibold">
        Plausibilitätsprüfung
        {errors.length > 0 && <span className="text-red-700">{errors.length} offen</span>}
        {warnings.length > 0 && <span className="text-amber-700">{warnings.length} Hinweise</span>}
      </header>
      <ul className="divide-y divide-line">
        {shown.map((i, n) => (
          <li key={n}>
            <Link
              to={issueHref(basePath, i.path)}
              className="flex gap-2 px-3 py-2 text-[12.5px] leading-snug hover:bg-primary-50/50"
            >
              {i.severity === "error" ? (
                <CircleAlert className="mt-px size-3.5 shrink-0 text-red-600" />
              ) : (
                <AlertTriangle className="mt-px size-3.5 shrink-0 text-amber-600" />
              )}
              <span className={cn(i.severity === "warning" && "text-muted")}>{i.message}</span>
            </Link>
          </li>
        ))}
      </ul>
      {compact && issues.length > shown.length && (
        <div className="border-t border-line px-3 py-1.5">
          <Link to={`${basePath}/ergebnis`} className="text-[12.5px] font-medium text-primary-700 hover:underline">
            Alle {issues.length} anzeigen
          </Link>
        </div>
      )}
    </section>
  );
}
