import { useState } from "react";
import { LevelMark } from "../components/level";
import { Empty, Field, Select, cn } from "../components/ui";
import { diffVersions, goalLevelChanges, type ChangeKind } from "../domain/diff";
import { GOAL_LABEL, STATUS_LABEL, type AssessmentVersion } from "../domain/types";
import { versionLabel } from "../domain/versioning";

const KIND: Record<ChangeKind, { label: string; value: string; mark: string }> = {
  escalated: { label: "verschärft", value: "text-red-700", mark: "↑" },
  relaxed: { label: "herabgestuft", value: "text-emerald-700", mark: "↓" },
  reasoning: { label: "Begründung", value: "text-emerald-700", mark: "" },
  context: { label: "Stammdaten / Umfang", value: "text-amber-700", mark: "" },
};

const TH = "px-3 py-2 text-left text-[12.5px] font-normal text-muted first:pl-0";

export function CompareStep({ versions, current }: { versions: AssessmentVersion[]; current: AssessmentVersion }) {
  const idx = versions.findIndex((v) => v.id === current.id);
  const [aId, setAId] = useState(versions[Math.max(0, idx - 1)]?.id ?? current.id);
  const [bId, setBId] = useState(current.id);
  const a = versions.find((v) => v.id === aId);
  const b = versions.find((v) => v.id === bId);

  const option = (v: AssessmentVersion) => (
    <option key={v.id} value={v.id}>
      Version {versionLabel(v)} · {STATUS_LABEL[v.status]}
    </option>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <div>
        <h2 data-focus-heading className="text-[20px] font-semibold focus:outline-none">Versionsvergleich</h2>
        <p className="mt-0.5 text-[14px] text-muted">
          Neue Werte in <span className="text-red-700">Rot</span> sind verschärft, in <span className="text-emerald-700">Grün</span>{" "}
          herabgestuft oder neu begründet, in <span className="text-amber-700">Gelb</span> geänderte Stammdaten.
        </p>
      </div>
      {versions.length < 2 ? (
        <Empty title="Noch keine zweite Version">
          Ein Vergleich ist möglich, sobald aus einer freigegebenen Version eine neue angelegt wurde.
        </Empty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vorher">
              {(id) => (
                <Select id={id} value={aId} onChange={(e) => setAId(e.target.value)}>
                  {versions.map(option)}
                </Select>
              )}
            </Field>
            <Field label="Nachher">
              {(id) => (
                <Select id={id} value={bId} onChange={(e) => setBId(e.target.value)}>
                  {versions.map(option)}
                </Select>
              )}
            </Field>
          </div>
          {a && b && <DiffView a={a} b={b} />}
        </>
      )}
    </div>
  );
}

function DiffView({ a, b }: { a: AssessmentVersion; b: AssessmentVersion }) {
  const changes = diffVersions(a, b);
  const goals = goalLevelChanges(a, b);
  return (
    <>
      <dl className="grid grid-cols-3 divide-x divide-line border-y border-line py-3">
        {goals.map((g, i) => (
          <div key={g.goal} className={cn("min-w-0", i === 0 ? "pr-3" : "px-3")}>
            <dt className="text-[12.5px] text-muted">{GOAL_LABEL[g.goal]}</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
              <LevelMark level={g.from} className="text-muted" />
              <span className="text-muted">→</span>
              <LevelMark level={g.to} className={cn(g.kind && "font-semibold")} />
            </dd>
          </div>
        ))}
      </dl>
      {changes.length === 0 ? (
        <p className="text-[14px] text-muted">Die Versionen sind inhaltlich identisch.</p>
      ) : (
        <div role="region" aria-label="Änderungen zwischen den Versionen" tabIndex={0} className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="border-b border-line">
              <tr>
                <th scope="col" className={cn(TH, "w-[32%]")}>Feld</th>
                <th scope="col" className={TH}>Vorher</th>
                <th scope="col" className={TH}>Nachher</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {changes.map((c) => {
                const k = KIND[c.kind];
                return (
                  <tr key={c.path}>
                    <td className="py-2.5 pr-3 align-top">
                      {c.label}
                      <div className="text-[12px] text-muted">{k.label}</div>
                    </td>
                    <td className="px-3 py-2.5 align-top break-words text-muted">{c.oldValue ?? "leer"}</td>
                    <td className={cn("px-3 py-2.5 align-top break-words", k.value)}>
                      {k.mark && <span className="mr-1">{k.mark}</span>}
                      {c.newValue ?? "leer"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
