import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { LevelPill } from "../components/level";
import { Empty, Field, Select, cn } from "../components/ui";
import { diffVersions, goalLevelChanges, type ChangeKind } from "../domain/diff";
import { GOAL_LABEL, STATUS_LABEL, type AssessmentVersion } from "../domain/types";
import { versionLabel } from "../domain/versioning";

const KIND_STYLE: Record<ChangeKind, { row: string; label: string; dot: string }> = {
  escalated: { row: "border-l-red-500 bg-red-50/60", label: "Verschärft", dot: "bg-red-500" },
  relaxed: { row: "border-l-emerald-500 bg-emerald-50/60", label: "Herabgestuft", dot: "bg-emerald-500" },
  reasoning: { row: "border-l-emerald-500 bg-emerald-50/30", label: "Begründung", dot: "bg-emerald-400" },
  context: { row: "border-l-amber-400 bg-amber-50/60", label: "Stammdaten / Umfang", dot: "bg-amber-400" },
};

export function CompareStep({ versions, current }: { versions: AssessmentVersion[]; current: AssessmentVersion }) {
  const idx = versions.findIndex((v) => v.id === current.id);
  const [aId, setAId] = useState(versions[Math.max(0, idx - 1)]?.id ?? current.id);
  const [bId, setBId] = useState(current.id);
  const a = versions.find((v) => v.id === aId);
  const b = versions.find((v) => v.id === bId);

  const option = (v: AssessmentVersion) => (
    <option key={v.id} value={v.id}>
      v{versionLabel(v)} · {STATUS_LABEL[v.status]}
    </option>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div>
        <h2 className="text-[21px] font-bold">Versionsvergleich</h2>
        <p className="mt-0.5 text-[13.5px] text-muted">
          Rot: verschärfter Schutzbedarf · Grün: herabgestuft oder neue Begründung · Gelb: Stammdaten und Geltungsbereich
        </p>
      </div>
      {versions.length < 2 ? (
        <Empty title="Noch keine zweite Version">
          Ein Vergleich wird möglich, sobald aus einer freigegebenen Version eine neue Version angelegt wurde.
        </Empty>
      ) : (
        <>
          <div className="grid items-end gap-3 rounded-lg border border-line bg-paper p-4 sm:grid-cols-[1fr_auto_1fr]">
            <Field label="Version A (Ausgangsstand)">
              {(id) => (
                <Select id={id} value={aId} onChange={(e) => setAId(e.target.value)}>
                  {versions.map(option)}
                </Select>
              )}
            </Field>
            <ArrowRight className="mb-2 hidden size-4 text-muted sm:block" />
            <Field label="Version B (Vergleichsstand)">
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
      <div className="grid gap-2 sm:grid-cols-3">
        {goals.map((g) => (
          <div
            key={g.goal}
            className={cn(
              "rounded-lg border bg-paper px-3 py-2.5",
              g.kind === "escalated" ? "border-red-300" : g.kind === "relaxed" ? "border-emerald-300" : "border-line",
            )}
          >
            <div className="text-[12px] font-semibold text-muted">{GOAL_LABEL[g.goal]}</div>
            <div className="mt-1 flex items-center gap-2">
              <LevelPill level={g.from} />
              <ArrowRight className="size-3.5 text-muted" />
              <LevelPill level={g.to} />
            </div>
          </div>
        ))}
      </div>
      {changes.length === 0 ? (
        <p className="rounded-lg border border-line bg-paper px-4 py-6 text-center text-[13px] text-muted">
          Die Versionen sind inhaltlich identisch.
        </p>
      ) : (
        <ul className="grid gap-1.5">
          {changes.map((c) => {
            const s = KIND_STYLE[c.kind];
            return (
              <li key={c.path} className={cn("rounded-md border border-l-4 border-line px-3 py-2", s.row)}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold">{c.label}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                    <span className={cn("size-1.5 rounded-full", s.dot)} />
                    {s.label}
                  </span>
                </div>
                <div className="mt-1 grid gap-1 text-[12.5px] sm:grid-cols-2">
                  <div className="break-words text-muted">
                    <span className="mr-1 font-semibold">A</span>
                    {c.oldValue ?? "–"}
                  </div>
                  <div className="break-words">
                    <span className="mr-1 font-semibold text-muted">B</span>
                    {c.newValue ?? "–"}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
