import { useId } from "react";
import { LevelBars, LevelMark } from "../components/level";
import { Field, Segmented, cn } from "../components/ui";
import type { ScenarioDef } from "../domain/catalog";
import { catalogFor, definitionsFor } from "../domain/scheme";
import { goalResult, scenarioLevel } from "../domain/scoring";
import { GOAL_EN, GOAL_LABEL, GOAL_SHORT, LEVEL_LABEL, type Goal, type ScenarioAnswer } from "../domain/types";
import { emptyAnswer } from "../domain/versioning";
import { CommitInput, useEditor } from "./editor";

const GOAL_QUESTION: Record<Goal, string> = {
  C: "Welcher Schaden entsteht, wenn Unbefugte die Informationen einsehen?",
  I: "Welcher Schaden entsteht, wenn Informationen oder Programmabläufe verfälscht werden?",
  A: "Welcher Schaden entsteht, wenn Informationen oder das System nicht zur Verfügung stehen?",
};

export function GoalStep({ goal }: { goal: Goal }) {
  const { version } = useEditor();
  const def = catalogFor(version.scheme)[goal];
  const r = goalResult(version, goal);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 data-focus-heading className="text-[20px] font-semibold focus:outline-none">
            {GOAL_LABEL[goal]} <span lang="en" className="font-normal text-muted">({GOAL_EN[goal]})</span>
          </h2>
          <p className="mt-0.5 text-[14px] text-muted">{GOAL_QUESTION[goal]}</p>
        </div>
        <p className="flex items-center gap-2 text-[13px] text-muted tabular">
          {r.answered} von {r.total} bewertet · Maximum <LevelMark level={r.computed} />
        </p>
      </div>
      {def.scenarios.map((s, i) => (
        <ScenarioCard
          key={s.id}
          goal={goal}
          def={s}
          index={i + 1}
          isDriver={r.complete && r.drivers.includes(s.id) && (r.computed ?? 0) > 1}
        />
      ))}
      {def.notApplicable.map((n) => (
        <p key={n.id} className="px-1 text-[13px] text-muted">
          <span className="font-medium">{n.title}: nicht bewertet.</span> {n.notApplicable}
        </p>
      ))}
    </div>
  );
}

function ScenarioCard({ goal, def, index, isDriver }: { goal: Goal; def: ScenarioDef; index: number; isDriver: boolean }) {
  const { version, readOnly, update } = useEditor();
  const answer = version.answers[goal][def.id] ?? emptyAnswer();
  const level = scenarioLevel(answer);
  const groupId = useId();
  const definition = definitionsFor(version.scheme).find((d) => d.scenario === def.id);
  const needsExplanation = level !== null && level >= 2;

  const set = (patch: Partial<ScenarioAnswer>) =>
    update((v) => {
      const cur = v.answers[goal][def.id] ?? emptyAnswer();
      const next = { ...cur, ...patch };
      if (next.applies === false) next.level = null;
      v.answers[goal][def.id] = next;
    });

  return (
    <section id={`${goal}.${def.id}`} className="scroll-mt-24 rounded-lg border border-line px-5 py-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="min-w-0 text-[15px] font-semibold">
          <span className="mr-2 font-normal text-muted tabular">
            {GOAL_SHORT[goal]}
            {index}
          </span>
          {def.title}
        </h3>
        <span className="flex items-center gap-3 text-[12.5px] text-muted">
          {isDriver && <span>bestimmt das Maximum</span>}
          <LevelMark level={level} />
        </span>
      </header>
      <p className="mt-0.5 text-[13px] text-muted">{def.hint}</p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5">
        <p className="max-w-2xl text-[14px]">{def.gate}</p>
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

      {answer.applies && (
        <fieldset className="mt-4 min-w-0">
          <legend className="mb-2 text-[13px] text-muted">{def.followUp}</legend>
          <div className="grid gap-1.5">
            {def.options.map((o) => {
              const checked = answer.level === o.level;
              return (
                <label
                  key={o.level}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors duration-100",
                    checked ? "border-primary-950 bg-surface" : "border-line hover:bg-surface",
                    readOnly && "cursor-default",
                    readOnly && !checked && "hover:bg-transparent",
                  )}
                >
                  <input
                    type="radio"
                    name={groupId}
                    className="mt-[3px] size-3.5 shrink-0 accent-primary-950"
                    checked={checked}
                    disabled={readOnly}
                    onChange={() => set({ level: o.level })}
                  />
                  <span className="min-w-0 flex-1 text-[13.5px] leading-snug">{o.text}</span>
                  <span className="flex w-[84px] shrink-0 items-center justify-end gap-1.5 pt-[2px] text-[12.5px] text-muted">
                    {LEVEL_LABEL[o.level]}
                    <LevelBars level={o.level} />
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {answer.applies !== null && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Erläuterung" required={needsExplanation} hint={needsExplanation ? "Bei Hoch und Sehr hoch erforderlich." : undefined}>
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
                placeholder="Betroffene Daten, Verträge, Annahmen"
              />
            )}
          </Field>
        </div>
      )}

      {definition && (
        <details className="mt-3 text-[13px]">
          <summary className="cursor-pointer text-muted hover:text-ink">Definitionen der Schutzbedarfskategorien</summary>
          <dl className="mt-3 grid gap-4 border-t border-line pt-3 md:grid-cols-3">
            {(
              [
                [1, definition.normal[goal]],
                [2, definition.high[goal]],
                [3, definition.veryHigh[goal]],
              ] as const
            ).map(([l, t]) => (
              <div key={l}>
                <dt className="mb-1">
                  <LevelMark level={l} />
                </dt>
                <dd className="leading-relaxed text-muted">{t}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}
