import { AlertTriangle, CircleAlert } from "lucide-react";
import { Link } from "react-router";
import { LevelMark } from "../components/level";
import { Field, Select, cn } from "../components/ui";
import { SCENARIO_SHORT } from "../domain/catalog";
import { MEASURES } from "../domain/measures";
import { goalResult, validate, type Issue } from "../domain/scoring";
import { GOALS, GOAL_EN, GOAL_LABEL, LEVEL_LABEL, OVERRIDE_KIND_LABEL, type Goal, type OverrideKind } from "../domain/types";
import { CommitInput, useEditor } from "./editor";

export function ResultStep({ basePath }: { basePath: string }) {
  const { version } = useEditor();
  const issues = validate(version);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
      <div>
        <h2 className="text-[20px] font-semibold">Ergebnis &amp; Begründung</h2>
        <p className="mt-0.5 text-[14px] text-muted">
          Maximumprinzip je Grundwert. Danach Kumulations-, Verteilungs- und Vererbungseffekte prüfen.
        </p>
      </div>
      {GOALS.map((g) => (
        <GoalPanel key={g} goal={g} basePath={basePath} />
      ))}
      <div className="border-t border-line pt-8">
        <h2 className="mb-3 text-[17px] font-semibold">Offene Punkte</h2>
        <IssueList issues={issues} basePath={basePath} />
      </div>
    </div>
  );
}

function GoalPanel({ goal, basePath }: { goal: Goal; basePath: string }) {
  const { version, readOnly, update } = useEditor();
  const r = goalResult(version, goal);
  const override = version.overrides[goal];
  const needsJustification = r.effective !== null && r.effective >= 2;
  const measures = r.effective === 3 ? [...MEASURES[goal][2], ...MEASURES[goal][3]] : r.effective === 2 ? MEASURES[goal][2] : [];

  return (
    <section className="grid gap-5 border-t border-line pt-8 first-of-type:border-t-0 first-of-type:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[17px] font-semibold">
          {GOAL_LABEL[goal]} <span className="font-normal text-muted">({GOAL_EN[goal]})</span>
        </h3>
        <LevelMark level={r.effective} className="text-[14px] font-medium" />
      </div>

      <p className="-mt-3 text-[13.5px] text-muted">
        {r.computed === null ? (
          "Noch keine Szenarien bewertet."
        ) : (
          <>
            Maximum aus {r.answered} von {r.total} Szenarien: {LEVEL_LABEL[r.computed]}
            {r.computed > 1 && (
              <>
                , bestimmt durch{" "}
                {r.drivers.map((d, i) => (
                  <span key={d}>
                    {i > 0 && ", "}
                    <Link className="text-ink underline decoration-line underline-offset-2 hover:decoration-ink" to={`${basePath}/${goal}#${goal}.${d}`}>
                      {SCENARIO_SHORT[d]}
                    </Link>
                  </span>
                ))}
              </>
            )}
            .
            {!r.complete && (
              <>
                {" "}
                <Link to={`${basePath}/${goal}`} className="text-primary-700 hover:underline">
                  {r.total - r.answered} offen
                </Link>
              </>
            )}
          </>
        )}
      </p>

      <div>
        <label className="flex items-start gap-2.5 text-[14px]">
          <input
            type="checkbox"
            className="mt-[4px] size-3.5 accent-primary-950"
            checked={!!override}
            disabled={readOnly || r.computed === null}
            onChange={(e) =>
              update((v) => {
                v.overrides[goal] = e.target.checked ? { level: r.computed ?? 1, kind: "cumulation", reason: "" } : null;
              })
            }
          />
          <span>
            Sondereffekt berücksichtigen
            <span className="block text-[13px] text-muted">
              Kumulation kann hochstufen, Verteilung durch Redundanz herabstufen, Vererbung übernimmt den Schutzbedarf
              abhängiger Prozesse und Anwendungen.
            </span>
          </span>
        </label>
        {override && (
          <div className="mt-4 grid gap-4 pl-6 md:grid-cols-2">
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
                  placeholder="z. B. Server hostet das Kunden-CRM (Vertraulichkeit sehr hoch), daher Vererbung."
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
        label="Begründung des Schutzbedarfs"
        required={needsJustification}
        hint={needsJustification ? "Erscheint auf dem Deckblatt und im Bericht." : "Bei Normal optional."}
      >
        {(id) => (
          <CommitInput
            id={id}
            multiline
            rows={3}
            value={version.justifications[goal]}
            onCommit={(val) =>
              update((v) => {
                v.justifications[goal] = val;
              })
            }
          />
        )}
      </Field>

      {measures.length > 0 && (
        <div>
          <h4 className="text-[13px] font-medium">Typische Maßnahmen bei {LEVEL_LABEL[r.effective!]}</h4>
          <ul className="mt-1.5 grid gap-x-8 gap-y-1 text-[13.5px] text-muted md:grid-cols-2">
            {measures.map((m) => (
              <li key={m} className="flex gap-2">
                <span aria-hidden>–</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
  const all = [...errors, ...warnings];
  const shown = compact ? all.slice(0, 6) : all;

  return (
    <div>
      {compact && (
        <h2 className="mb-1 text-[13px] font-semibold">
          Offene Punkte <span className="font-normal text-muted tabular">{errors.length}</span>
        </h2>
      )}
      {all.length === 0 ? (
        <p className="text-[13px] text-muted">Keine. Die Analyse kann eingereicht werden.</p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((i, n) => (
            <li key={n}>
              <Link to={issueHref(basePath, i.path)} className="group flex gap-2 py-2 text-[13px] leading-snug">
                {i.severity === "error" ? (
                  <CircleAlert className="mt-[2px] size-3.5 shrink-0 text-red-700" />
                ) : (
                  <AlertTriangle className="mt-[2px] size-3.5 shrink-0 text-amber-600" />
                )}
                <span className={cn("group-hover:underline", i.severity === "warning" && "text-muted")}>{i.message}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {compact && all.length > shown.length && (
        <Link to={`${basePath}/ergebnis`} className="mt-1 inline-block text-[12.5px] text-primary-700 hover:underline">
          Alle {all.length} anzeigen
        </Link>
      )}
    </div>
  );
}
