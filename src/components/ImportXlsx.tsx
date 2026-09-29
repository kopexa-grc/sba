import { AlertTriangle, CircleAlert, FileSpreadsheet, Info, Upload } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "../app/session";
import { repo } from "../db/repo";
import { CATALOG, SCENARIO_SHORT } from "../domain/catalog";
import { scenarioLevel } from "../domain/scoring";
import { GOALS, GOAL_LABEL, LEVEL_LABEL, type Answers, type Goal, type ScenarioAnswer, type ScenarioId } from "../domain/types";
import { emptyAnswer } from "../domain/versioning";
import type { LegacyImport } from "../io/xlsx/import";
import { LevelPill } from "./level";
import { Badge, Button, Dialog, Field, Input, Select, cn } from "./ui";

type Key = `${Goal}.${ScenarioId}`;

interface Review {
  fileName: string;
  data: LegacyImport;
  name: string;
  answers: Answers;
  rows: Partial<Record<Key, number | null>>;
  conflicts: Set<Key>;
}

export function ImportXlsxDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { actor, identity, notify, guard } = useSession();
  const navigate = useNavigate();

  function close() {
    setReview(null);
    onClose();
  }

  async function load(file: File) {
    setBusy(true);
    const res = await guard(async () => {
      const { parseLegacyXlsx } = await import("../io/xlsx/import");
      return parseLegacyXlsx(await file.arrayBuffer());
    });
    setBusy(false);
    if (!res) return;
    const conflicts = new Set<Key>();
    for (const i of res.issues) if (i.severity === "conflict" && i.goal && i.scenario) conflicts.add(`${i.goal}.${i.scenario}`);
    setReview({
      fileName: file.name,
      data: res,
      name: res.meta.name ?? file.name.replace(/\.xlsx$/i, ""),
      answers: structuredClone(res.answers),
      rows: Object.fromEntries(res.rows.map((r) => [`${r.goal}.${r.scenario}`, r.row])),
      conflicts,
    });
  }

  async function remap(goal: Goal, id: ScenarioId, row: number | null) {
    if (!review) return;
    const { readScenarioAt } = await import("../io/xlsx/import");
    const def = CATALOG[goal].scenarios.find((s) => s.id === id)!;
    const key: Key = `${goal}.${id}`;
    const next = structuredClone(review.answers);
    const conflicts = new Set(review.conflicts);
    conflicts.delete(key);
    if (row === null) {
      delete next[goal][id];
    } else {
      const res = readScenarioAt(review.data.snapshot, goal, def, row);
      next[goal][id] = res.answer;
      if (res.issues.some((i) => i.severity === "conflict")) conflicts.add(key);
    }
    setReview({ ...review, answers: next, rows: { ...review.rows, [key]: row }, conflicts });
  }

  function setAnswer(goal: Goal, id: ScenarioId, patch: Partial<ScenarioAnswer>) {
    if (!review) return;
    const next = structuredClone(review.answers);
    next[goal][id] = { ...(next[goal][id] ?? emptyAnswer()), ...patch };
    setReview({ ...review, answers: next });
  }

  async function confirm() {
    if (!review) return;
    const { data } = review;
    const v = await guard(async () => {
      const created = await repo.createAsset(actor, {
        ...data.meta,
        name: review.name.trim() || "Importiertes Asset",
        assessor: data.meta.assessor || identity?.name || "",
      });
      await repo.updateDraft(created.id, actor, (x) => {
        x.answers = review.answers;
        x.justifications = data.justifications;
        x.overrides = data.overrides;
        x.changeSummary = `Übernahme aus ${review.fileName}`;
      });
      await repo.logImport(
        created,
        actor,
        `${review.fileName}${data.versionLabel ? ` · Version ${data.versionLabel}` : ""}${data.statusText ? ` · Status „${data.statusText}“` : ""}`,
      );
      return created;
    });
    if (!v) return;
    close();
    notify("Excel-Bogen übernommen. Bitte prüfen Sie die Angaben und reichen Sie die Analyse anschließend ein.");
    navigate(`/a/${v.assetId}/v/${v.id}/ergebnis`);
  }

  const issues = review?.data.issues.filter((i) => i.severity !== "info") ?? [];
  const infos = review?.data.issues.filter((i) => i.severity === "info") ?? [];
  const openConflicts = review
    ? [...review.conflicts].filter((k) => {
        const [g, s] = k.split(".") as [Goal, ScenarioId];
        const a = review.answers[g][s];
        return !(a && scenarioLevel(a) !== null);
      })
    : [];

  return (
    <Dialog
      open={open}
      onClose={close}
      wide={!!review}
      title={review ? "Excel-Bogen prüfen und übernehmen" : "Bestehenden Excel-Bogen übernehmen"}
      description={
        review ? (
          <>
            <FileSpreadsheet className="mr-1 inline size-3.5" />
            {review.fileName} – Zuordnung der Zeilen prüfen, Widersprüche auflösen, dann als neuen Entwurf anlegen.
          </>
        ) : (
          "Unterstützt FS_Schutzbedarfsanalyse.xlsx sowie Excel-Prüfberichte aus dieser App. Die Datei wird nur lokal gelesen."
        )
      }
      footer={
        review ? (
          <>
            <Button onClick={() => setReview(null)}>Andere Datei</Button>
            <Button variant="primary" disabled={openConflicts.length > 0} onClick={confirm}>
              Als Entwurf übernehmen
            </Button>
          </>
        ) : (
          <Button onClick={close}>Abbrechen</Button>
        )
      }
    >
      {!review ? (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) load(f);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragging ? "border-primary-500 bg-primary-50" : "border-line hover:border-primary-300 hover:bg-primary-50/40",
          )}
        >
          <Upload className="size-6 text-muted" />
          <span className="text-[14px] font-medium">{busy ? "Datei wird gelesen …" : "XLSX-Datei hierher ziehen oder auswählen"}</span>
          <span className="text-[12.5px] text-muted">Deckblatt, Fragebogen und Begründungen werden übernommen.</span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) load(f);
              e.target.value = "";
            }}
          />
        </label>
      ) : (
        <div className="grid gap-4">
          <Field label="Asset-Bezeichnung" required>
            {(id) => <Input id={id} value={review.name} onChange={(e) => setReview({ ...review, name: e.target.value })} />}
          </Field>
          {(review.data.versionLabel || review.data.statusText) && (
            <p className="flex gap-2 rounded-md bg-surface px-3 py-2 text-[12.5px] text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              Im Bogen vermerkt: {review.data.versionLabel && <>Version „{review.data.versionLabel}“</>}
              {review.data.statusText && <> · Status „{review.data.statusText}“</>}. Die Übernahme startet als Entwurf v1.0 –
              die Angaben werden im Audit-Trail festgehalten, eine Freigabe muss in der App erneut erfolgen.
            </p>
          )}
          {issues.length > 0 && (
            <ul className="grid gap-1 rounded-md border border-line p-2">
              {issues.map((i, n) => (
                <li key={n} className="flex gap-2 text-[12.5px]">
                  {i.severity === "conflict" ? (
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-red-600" />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                  )}
                  {i.message}
                </li>
              ))}
            </ul>
          )}
          {GOALS.map((g) => (
            <div key={g}>
              <h3 className="mb-1.5 text-[13px] font-semibold">{GOAL_LABEL[g]}</h3>
              <div className="overflow-x-auto rounded-md border border-line">
                <table className="w-full min-w-[620px] text-[12.5px]">
                  <tbody className="divide-y divide-line">
                    {CATALOG[g].scenarios.map((s) => {
                      const key: Key = `${g}.${s.id}`;
                      const det = review.data.rows.find((r) => r.goal === g && r.scenario === s.id);
                      const answer = review.answers[g][s.id];
                      const level = scenarioLevel(answer);
                      const conflict = review.conflicts.has(key) && level === null;
                      return (
                        <tr key={s.id} className={cn(conflict && "bg-red-50/60")}>
                          <td className="w-[28%] px-2.5 py-2 font-medium">{SCENARIO_SHORT[s.id]}</td>
                          <td className="w-[36%] px-2.5 py-1.5">
                            <Select
                              aria-label={`Zeile für ${SCENARIO_SHORT[s.id]}`}
                              value={review.rows[key] ?? ""}
                              onChange={(e) => remap(g, s.id, e.target.value ? Number(e.target.value) : null)}
                              className="h-7 text-[12px]"
                            >
                              <option value="">– nicht zuordnen –</option>
                              {review.data.candidateRows.map((c) => (
                                <option key={c.row} value={c.row}>
                                  Z. {c.row}: {c.text.slice(0, 70)}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-2.5 py-2">
                            {det?.confidence === "shifted" && <Badge tone="warning">verschoben</Badge>}
                            {det?.confidence === "missing" && <Badge tone="danger">nicht gefunden</Badge>}
                          </td>
                          <td className="px-2.5 py-1.5 text-right">
                            {conflict ? (
                              <Select
                                aria-label="Widerspruch auflösen"
                                value=""
                                onChange={(e) => {
                                  const l = Number(e.target.value);
                                  setAnswer(g, s.id, l === 1 ? { applies: false, level: null } : { applies: true, level: l as 2 | 3 });
                                }}
                                className="h-7 w-auto border-red-300 text-[12px]"
                              >
                                <option value="">Widerspruch – Einstufung wählen</option>
                                {([1, 2, 3] as const).map((l) => (
                                  <option key={l} value={l}>
                                    {LEVEL_LABEL[l]}
                                  </option>
                                ))}
                              </Select>
                            ) : (
                              <LevelPill level={level} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {infos.length > 0 && (
            <details className="text-[12px] text-muted">
              <summary className="cursor-pointer">{infos.length} Hinweise zur Erkennung</summary>
              <ul className="mt-1 list-disc pl-5">
                {infos.map((i, n) => (
                  <li key={n}>{i.message}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Dialog>
  );
}
