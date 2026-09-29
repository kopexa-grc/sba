import { AlertTriangle, CircleAlert, ExternalLink } from "lucide-react";
import { Link } from "react-router";
import { LevelMark } from "../components/level";
import { Field, Select, cn } from "../components/ui";
import { SCENARIO_SHORT } from "../domain/catalog";
import { useSettings } from "../app/data";
import { useFileActions } from "../app/file-actions";
import { nextSteps } from "../domain/next-steps";
import { DEFAULT_MEASURES } from "../domain/scheme";
import { goalResult, validate, type Issue } from "../domain/scoring";
import { GOALS, GOAL_EN, GOAL_LABEL, LEVEL_LABEL, OVERRIDE_KIND_LABEL, type Goal, type OverrideKind } from "../domain/types";
import { CommitInput, useEditor } from "./editor";

/** Plain-language explanation of each special effect, shown under the selection. */
const OVERRIDE_KIND_HINT: Record<OverrideKind, string> = {
  inheritance:
    "Etwas Wichtigeres hängt hiervon ab. Beispiel: Auf dem Server läuft das Kunden-CRM, also braucht der Server mindestens denselben Schutz.",
  cumulation:
    "Viele kleine Schäden ergeben zusammen einen großen. Beispiel: Auf einem Server laufen 30 Anwendungen, ein Ausfall trifft alle gleichzeitig. Die Stufe steigt.",
  distribution:
    "Es gibt Ersatz. Beispiel: Fällt ein Server aus, übernimmt ein zweiter sofort. Der Ausfall schadet weniger, die Stufe kann sinken.",
  other: "Ein anderer Grund. Beschreiben Sie ihn unten.",
};

const OVERRIDE_KIND_EXAMPLE: Record<OverrideKind, string> = {
  inheritance: "z. B. Auf dem Server läuft das Kunden-CRM, das „Sehr hoch“ eingestuft ist.",
  cumulation: "z. B. Auf dem Cluster laufen 30 Fachanwendungen, ein Ausfall legt alle gleichzeitig lahm.",
  distribution: "z. B. Ein zweites Rechenzentrum übernimmt bei Ausfall innerhalb von Minuten.",
  other: "Beschreiben Sie, warum das berechnete Ergebnis nicht passt.",
};

export function ResultStep({ basePath }: { basePath: string }) {
  const { version } = useEditor();
  const issues = validate(version);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
      <div>
        <h2 data-focus-heading className="text-[20px] font-semibold focus:outline-none">Ergebnis &amp; Begründung</h2>
        <p className="mt-0.5 text-[14px] text-muted">
          Je Grundwert zählt die höchste Einstufung aus den Fragen. Passt das nicht zur Wirklichkeit, passen Sie es mit
          Begründung an.
        </p>
      </div>
      {GOALS.map((g) => (
        <GoalPanel key={g} goal={g} basePath={basePath} />
      ))}
      <NextSteps />
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
  const catalog = useSettings()?.measures ?? DEFAULT_MEASURES;
  const measures = r.effective === 3 ? [...catalog[goal][2], ...catalog[goal][3]] : r.effective === 2 ? catalog[goal][2] : [];

  return (
    <section className="grid gap-5 border-t border-line pt-8 first-of-type:border-t-0 first-of-type:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[17px] font-semibold">
          {GOAL_LABEL[goal]} <span lang="en" className="font-normal text-muted">({GOAL_EN[goal]})</span>
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
                <Link to={`${basePath}/${goal}`} className="text-primary-700 underline underline-offset-2">
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
            onChange={(e) => {
              // Read the event now: the mutation runs asynchronously, after React has reset the controlled input.
              const checked = e.target.checked;
              void update((v) => {
                v.overrides[goal] = checked ? { level: r.computed ?? 1, kind: "cumulation", reason: "" } : null;
              });
            }}
          />
          <span>
            Ergebnis anpassen (Sondereffekt)
            <span className="block text-[13px] text-muted">
              Die App nimmt automatisch die höchste Einstufung. Manchmal ist das zu niedrig oder zu hoch, etwa weil auf einem
              Server viele wichtige Anwendungen laufen oder weil es ein Ersatzsystem gibt. Dann legen Sie die Stufe hier selbst
              fest.
            </span>
          </span>
        </label>
        {override && (
          <div className="mt-4 grid gap-4 pl-6 md:grid-cols-2">
            <Field label="Grund" hint={OVERRIDE_KIND_HINT[override.kind]}>
              {(id) => (
                <Select
                  id={id}
                  value={override.kind}
                  disabled={readOnly}
                  onChange={(e) => {
                    const kind = e.target.value as OverrideKind;
                    void update((v) => {
                      v.overrides[goal] = { ...override, kind };
                    });
                  }}
                >
                  {(Object.keys(OVERRIDE_KIND_LABEL) as OverrideKind[]).map((k) => (
                    <option key={k} value={k}>
                      {OVERRIDE_KIND_LABEL[k]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Neuer Schutzbedarf" hint={`Berechnet: ${r.computed ? LEVEL_LABEL[r.computed] : "offen"}`}>
              {(id) => (
                <Select
                  id={id}
                  value={override.level}
                  disabled={readOnly}
                  onChange={(e) => {
                    const level = Number(e.target.value) as 1 | 2 | 3;
                    void update((v) => {
                      v.overrides[goal] = { ...override, level };
                    });
                  }}
                >
                  {([1, 2, 3] as const).map((l) => (
                    <option key={l} value={l}>
                      {LEVEL_LABEL[l]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Begründung der Anpassung" required className="md:col-span-2">
              {(id) => (
                <CommitInput
                  id={id}
                  multiline
                  rows={2}
                  value={override.reason}
                  placeholder={OVERRIDE_KIND_EXAMPLE[override.kind]}
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

/** Follow-up steps in the ISMS; knowledge links open kopexa.com in a new tab. */
function NextSteps() {
  const { version } = useEditor();
  const files = useFileActions();
  const steps = nextSteps(version);
  return (
    <section className="border-t border-line pt-8" aria-labelledby="next-steps">
      <h2 id="next-steps" className="text-[17px] font-semibold">
        Wie geht es weiter?
      </h2>
      <p className="mt-0.5 text-[13.5px] text-muted">Die Schutzbedarfsanalyse ist der Anfang. Diese Schritte folgen im ISMS.</p>
      <ol className="mt-4 grid gap-4">
        {steps.map((s, i) => (
          <li key={s.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2">
            <span className="text-[13.5px] text-muted tabular" aria-hidden>
              {i + 1}.
            </span>
            <div>
              <h3 className="text-[14px] font-medium">{s.title}</h3>
              <p className="mt-0.5 text-[13.5px] text-muted">{s.body}</p>
              {(s.link || s.action) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                  {s.action === "capture-assets" && (
                    <button type="button" onClick={files.captureAssets} className="text-primary-700 underline underline-offset-2">
                      Abhängige Assets erfassen
                    </button>
                  )}
                  {s.link && (
                    <a
                      href={s.link.href}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 text-primary-700 underline underline-offset-2"
                    >
                      {s.link.label}
                      <ExternalLink className="size-3" aria-hidden />
                      <span className="sr-only">(öffnet kopexa.com in neuem Tab)</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
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
        <p className="text-[13px] text-muted">Keine. Die Version kann abgeschlossen werden.</p>
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
        <Link to={`${basePath}/ergebnis`} className="mt-1 inline-block text-[12.5px] text-primary-700 underline underline-offset-2">
          Alle {all.length} anzeigen
        </Link>
      )}
    </div>
  );
}
