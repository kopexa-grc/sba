import { Info } from "lucide-react";
import { useId } from "react";
import { LevelGauge, LevelPill, LEVEL_BG } from "../components/level";
import { Field, Segmented, cn } from "../components/ui";
import { CATALOG, type ScenarioDef } from "../domain/catalog";
import { DEFINITIONS } from "../domain/definitions";
import { goalResult, scenarioLevel } from "../domain/scoring";
import { GOAL_LABEL, LEVEL_LABEL, type Goal, type ScenarioAnswer } from "../domain/types";
import { emptyAnswer } from "../domain/versioning";
import { CommitInput, useEditor } from "./editor";

const GOAL_QUESTION: Record<Goal, string> = {
  C: "Welcher Schaden entsteht, wenn Unbefugte die Informationen einsehen?",
  I: "Welcher Schaden entsteht, wenn Informationen oder Programmabläufe verfälscht werden?",
  A: "Welcher Schaden entsteht, wenn Informationen oder das System nicht zur Verfügung stehen?",
};

export function GoalStep({ goal }: { goal: Goal }) {
  const { version } = useEditor();
  const def = CATALOG[goal];
  const r = goalResult(version, goal);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[21px] font-bold">{GOAL_LABEL[goal]}</h2>
          <p className="mt-0.5 text-[13.5px] text-muted">{GOAL_QUESTION[goal]}</p>
        </div>
        <div className="flex items-center gap-2 text-[12.5px] text-muted tabular">
          {r.answered}/{r.total} beantwortet · Maximum
          <LevelPill level={r.computed} />
        </div>
      </div>
      {def.scenarios.map((s, i) => (
        <ScenarioCard key={s.id} goal={goal} def={s} index={i + 1} isDriver={r.complete && r.drivers.includes(s.id) && (r.computed ?? 0) > 1} />
      ))}
      {def.notApplicable.map((n) => (
        <section key={n.id} className="rounded-lg border border-dashed border-line bg-paper/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-semibold text-muted">{n.title}</h3>
            <span className="text-[11.5px] text-muted">nicht relevant</span>
          </div>
          <p className="mt-1 text-[13px] text-muted">{n.notApplicable}</p>
        </section>
      ))}
    </div>
  );
}

function ScenarioCard({ goal, def, index, isDriver }: { goal: Goal; def: ScenarioDef; index: number; isDriver: boolean }) {
  const { version, readOnly, update } = useEditor();
  const answer = version.answers[goal][def.id] ?? emptyAnswer();
  const level = scenarioLevel(answer);
  const groupId = useId();
  const definition = DEFINITIONS.find((d) => d.scenario === def.id);

  const set = (patch: Partial<ScenarioAnswer>) =>
    update((v) => {
      const cur = v.answers[goal][def.id] ?? emptyAnswer();
      const next = { ...cur, ...patch };
      if (next.applies === false) next.level = null;
      v.answers[goal][def.id] = next;
    });

  return (
    <section
      id={`${goal}.${def.id}`}
      className={cn(
        "scroll-mt-28 rounded-lg border bg-paper transition-shadow",
        isDriver ? "border-ink/25 shadow-[inset_3px_0_0_var(--color-ink)]" : "border-line",
      )}
    >
      <header className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-line px-4 py-3">
        <span className="mt-0.5 font-display text-[12px] font-semibold text-muted tabular">
          {goal === "C" ? "V" : goal === "I" ? "I" : "A"}
          {index}
        </span>
        <div className="min-w-0 flex-1 basis-[60%]">
          <h3 className="text-[15px] leading-snug font-semibold">{def.title}</h3>
          <p className="mt-0.5 text-[12.5px] text-muted">{def.hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 max-sm:pl-6 sm:flex-col sm:items-end sm:gap-1">
          <LevelPill level={level} />
          {isDriver && <span className="text-[11px] font-medium text-ink">bestimmt das Maximum</span>}
        </div>
      </header>

      <div className="grid gap-4 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <p className="max-w-2xl text-[14px] font-medium">{def.gate}</p>
          <Segmented
            label={def.gate}
            value={answer.applies}
            disabled={readOnly}
            options={[
              { value: true, label: "Ja" },
              { value: false, label: "Nein" },
            ]}
            onChange={(applies) => set({ applies })}
          />
        </div>

        {answer.applies === false && (
          <p className="-mt-1 text-[12.5px] text-muted">
            Einstufung <strong className="text-emerald-700">Normal</strong> – das Szenario ist nicht einschlägig.
          </p>
        )}

        {answer.applies && (
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-[13px] text-muted">{def.followUp}</legend>
            {def.options.map((o) => {
              const checked = answer.level === o.level;
              return (
                <label
                  key={o.level}
                  className={cn(
                    "group relative flex cursor-pointer items-start gap-3 overflow-hidden rounded-md border py-2.5 pr-3 pl-4 transition-colors",
                    checked ? "border-ink/30 bg-surface" : "border-line hover:border-primary-200 hover:bg-primary-50/40",
                    readOnly && "cursor-default",
                  )}
                >
                  <span className={cn("absolute inset-y-0 left-0 w-1", checked ? LEVEL_BG[o.level] : "bg-transparent")} />
                  <input
                    type="radio"
                    name={groupId}
                    className="mt-1 size-3.5 accent-primary-950"
                    checked={checked}
                    disabled={readOnly}
                    onChange={() => set({ level: o.level })}
                  />
                  <span className="min-w-0 flex-1 text-[13.5px] leading-snug">{o.text}</span>
                  <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[12px] font-medium text-muted">
                    <LevelGauge level={o.level} />
                    {LEVEL_LABEL[o.level]}
                  </span>
                </label>
              );
            })}
          </fieldset>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <Field
            label="Erläuterung Schutzbedarf"
            required={level !== null && level >= 2}
            hint={level !== null && level >= 2 ? "Pflicht bei „Hoch“ und „Sehr hoch“ – Auditoren fordern diese Begründung." : undefined}
          >
            {(id) => (
              <CommitInput
                id={id}
                multiline
                rows={2}
                value={answer.explanation}
                onCommit={(explanation) => set({ explanation })}
                placeholder="Warum diese Einstufung?"
              />
            )}
          </Field>
          <Field label="Weitere Ausführungen">
            {(id) => (
              <CommitInput
                id={id}
                multiline
                rows={2}
                value={answer.notes}
                onCommit={(notes) => set({ notes })}
                placeholder="Betroffene Daten, Verträge, Annahmen …"
              />
            )}
          </Field>
        </div>

        {definition && (
          <details className="group text-[12.5px] text-muted">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 hover:text-ink">
              <Info className="size-3.5" /> Definition der Schutzbedarfskategorien
            </summary>
            <dl className="mt-2 grid gap-2 rounded-md bg-surface p-3 md:grid-cols-3">
              {(
                [
                  [1, definition.normal[goal]],
                  [2, definition.high[goal]],
                  [3, definition.veryHigh[goal]],
                ] as const
              ).map(([l, t]) => (
                <div key={l}>
                  <dt className="mb-1">
                    <LevelPill level={l} />
                  </dt>
                  <dd className="leading-relaxed text-ink/80">{t}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </div>
    </section>
  );
}
