import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useEffect } from "react";
import { Link, Navigate, NavLink, useLocation, useNavigate, useParams } from "react-router";
import { useAudit, useIntegrity, useVersion, useVersions } from "../app/data";
import { useSession } from "../app/session";
import { LevelGauge, LevelPill, Seal } from "../components/level";
import { StatusBadge } from "../components/StatusBadge";
import { Badge, Button, Select, cn } from "../components/ui";
import { allResults, goalResult, validate } from "../domain/scoring";
import { ASSET_TYPE_LABEL, GOAL_LABEL, STATUS_LABEL, type Goal } from "../domain/types";
import { versionLabel } from "../domain/versioning";
import { actorName, formatDateTime } from "../lib/format";
import { CompareStep } from "../workspace/CompareStep";
import { EditorProvider } from "../workspace/editor";
import { GoalStep } from "../workspace/GoalStep";
import { HistoryStep } from "../workspace/HistoryStep";
import { MetaStep } from "../workspace/MetaStep";
import { IssueList, ResultStep } from "../workspace/ResultStep";
import { WorkflowActions } from "../workspace/WorkflowActions";

type Step = "stammdaten" | Goal | "ergebnis" | "historie" | "vergleich";

const WIZARD: { step: Step; label: string }[] = [
  { step: "stammdaten", label: "Asset & Scope" },
  { step: "C", label: "Vertraulichkeit" },
  { step: "I", label: "Integrität" },
  { step: "A", label: "Verfügbarkeit" },
  { step: "ergebnis", label: "Ergebnis & Begründung" },
];
const RECORD: { step: Step; label: string }[] = [
  { step: "historie", label: "Historie & Audit-Trail" },
  { step: "vergleich", label: "Versionsvergleich" },
];
const STEPS = new Set<string>([...WIZARD, ...RECORD].map((s) => s.step));

export function Workspace() {
  const { assetId, versionId, step: rawStep } = useParams();
  const version = useVersion(versionId);
  const versions = useVersions(assetId);
  const audit = useAudit(assetId);
  const integrity = useIntegrity(version);
  const navigate = useNavigate();
  const { hash } = useLocation();
  const { notify } = useSession();
  const step = (rawStep ?? "stammdaten") as Step;

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0 });
      return;
    }
    const t = setTimeout(() => document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ behavior: "smooth" }), 60);
    return () => clearTimeout(t);
  }, [step, hash]);

  if (version === undefined || versions === undefined || audit === undefined) {
    return version === undefined && versions !== undefined ? <Navigate to="/" replace /> : null;
  }
  if (!STEPS.has(step)) return <Navigate to={`/a/${assetId}/v/${versionId}`} replace />;

  const basePath = `/a/${version.assetId}/v/${version.id}`;
  const results = allResults(version);
  const issues = validate(version);
  const wizardIndex = WIZARD.findIndex((s) => s.step === step);
  const successor = version.supersededBy ? versions.find((v) => v.id === version.supersededBy) : undefined;

  const stepState = (s: Step): { done: boolean; hint: string | null } => {
    if (s === "C" || s === "I" || s === "A") {
      const r = goalResult(version, s);
      return { done: r.complete, hint: `${r.answered}/${r.total}` };
    }
    if (s === "stammdaten") return { done: !!version.meta.name && !!version.meta.owner, hint: null };
    if (s === "ergebnis") return { done: !issues.some((i) => i.severity === "error"), hint: null };
    return { done: false, hint: null };
  };

  return (
    <EditorProvider version={version}>
      <div className="border-b border-line bg-paper">
        <div className="mx-auto max-w-[1440px] px-4 pt-4 pb-3">
          <Link to="/" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink">
            <ChevronLeft className="size-3.5" /> Alle Analysen
          </Link>
          <div className="mt-1 flex flex-col gap-3 md:flex-row md:items-start md:gap-x-6">
            <div className="min-w-0 flex-1">
              <h1 className="text-[22px] leading-tight font-bold break-words md:truncate md:text-[24px]">{version.meta.name || "Unbenanntes Asset"}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
                <Select
                  aria-label="Version wählen"
                  value={version.id}
                  onChange={(e) => navigate(`/a/${version.assetId}/v/${e.target.value}/${step}`)}
                  className="h-6 w-auto py-0 pr-7 pl-2 text-[12px] font-semibold"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      v{versionLabel(v)} · {STATUS_LABEL[v.status]}
                    </option>
                  ))}
                </Select>
                <StatusBadge status={version.status} />
                <span>{ASSET_TYPE_LABEL[version.meta.type]}</span>
                {version.meta.owner && <span>· Owner: {version.meta.owner}</span>}
                <span>
                  · zuletzt {formatDateTime(version.updatedAt)} von {actorName(version.updatedBy)}
                </span>
              </div>
            </div>
            <WorkflowActions
              version={version}
              versions={versions}
              onBlocked={() => {
                notify("Vor dem Einreichen müssen alle Pflichtangaben vollständig sein.", "error");
                navigate(`${basePath}/ergebnis`);
              }}
            />
          </div>
        </div>
      </div>

      {version.status !== "draft" && (
        <div
          className={cn(
            "border-b px-4 py-2 text-[13px]",
            version.status === "review" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-line bg-primary-50 text-primary-950",
          )}
        >
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-2">
            <Lock className="size-3.5 shrink-0" />
            {version.status === "review" && (
              <span>
                In Prüfung seit {formatDateTime(version.submitted?.at)} (eingereicht von {actorName(version.submitted?.by ?? "")})
                {version.submitted?.comment && <> – „{version.submitted.comment}“</>}. Inhalte sind schreibgeschützt.
              </span>
            )}
            {version.status === "approved" && (
              <span>
                Freigegeben am {formatDateTime(version.approved?.at)} von {actorName(version.approved?.by ?? "")} – schreibgeschützt.
                Änderungen nur über „Neue Version anlegen“.
              </span>
            )}
            {version.status === "archived" && (
              <span>
                Archiviert{successor && <> – abgelöst durch v{versionLabel(successor)}</>}. Diese Version dient nur noch der Nachvollziehbarkeit.
              </span>
            )}
          </div>
        </div>
      )}

      {version.status === "draft" && version.rejections.length > 0 && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-[13px] text-red-900">
          <div className="mx-auto max-w-[1440px]">
            Zurückgewiesen von {actorName(version.rejections.at(-1)!.by)} am {formatDateTime(version.rejections.at(-1)!.at)}: „
            {version.rejections.at(-1)!.comment}“
          </div>
        </div>
      )}

      <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)_320px]">
        <nav aria-label="Schritte" className="no-print lg:sticky lg:top-16 lg:self-start">
          <ol className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {WIZARD.map((s, i) => {
              const st = stepState(s.step);
              return (
                <li key={s.step} className="shrink-0">
                  <NavLink
                    to={`${basePath}/${s.step}`}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
                        isActive || (s.step === "stammdaten" && !rawStep) ? "bg-paper font-semibold shadow-sm ring-1 ring-line" : "text-muted hover:bg-paper/70 hover:text-ink",
                      )
                    }
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular",
                        st.done ? "bg-primary-950 text-white" : "bg-line text-muted",
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="whitespace-nowrap">{s.label}</span>
                    {s.step.length === 1 && (
                      <span className="ml-auto hidden pl-2 lg:block" title={results[s.step as Goal].effective ? undefined : "offen"}>
                        <LevelGauge level={results[s.step as Goal].effective} />
                      </span>
                    )}
                  </NavLink>
                </li>
              );
            })}
            <li className="mx-2 my-1 hidden border-t border-line lg:block" aria-hidden />
            {RECORD.map((s) => (
              <li key={s.step} className="shrink-0">
                <NavLink
                  to={`${basePath}/${s.step}`}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] whitespace-nowrap transition-colors",
                      isActive ? "bg-paper font-semibold shadow-sm ring-1 ring-line" : "text-muted hover:bg-paper/70 hover:text-ink",
                    )
                  }
                >
                  {s.label}
                  {s.step === "historie" && (
                    <Badge tone="neutral" className="ml-auto tabular">
                      {versions.length}
                    </Badge>
                  )}
                </NavLink>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0">
          <div className="mb-5 xl:hidden">
            <Seal results={results} integrity={integrity} hash={version.hash} compact />
          </div>
          {step === "stammdaten" && <MetaStep />}
          {(step === "C" || step === "I" || step === "A") && <GoalStep goal={step} />}
          {step === "ergebnis" && <ResultStep basePath={basePath} />}
          {step === "historie" && <HistoryStep versions={versions} audit={audit} current={version} />}
          {step === "vergleich" && <CompareStep key={version.id} versions={versions} current={version} />}

          {wizardIndex >= 0 && (
            <div className="no-print mt-6 flex items-center justify-between gap-2 border-t border-line pt-4">
              {wizardIndex > 0 ? (
                <Button icon={<ChevronLeft className="size-4" />} onClick={() => navigate(`${basePath}/${WIZARD[wizardIndex - 1]!.step}`)}>
                  {WIZARD[wizardIndex - 1]!.label}
                </Button>
              ) : (
                <span />
              )}
              {wizardIndex < WIZARD.length - 1 && (
                <Button variant="primary" onClick={() => navigate(`${basePath}/${WIZARD[wizardIndex + 1]!.step}`)}>
                  Weiter: {WIZARD[wizardIndex + 1]!.label}
                  <ChevronRight className="size-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        <aside className="no-print hidden xl:block">
          <div className="sticky top-16 grid gap-4">
            <Seal results={results} integrity={integrity} hash={version.hash} />
            <GoalSummary results={results} basePath={basePath} />
            {version.status === "draft" && <IssueList issues={issues} basePath={basePath} compact />}
          </div>
        </aside>
      </div>
    </EditorProvider>
  );
}

function GoalSummary({ results, basePath }: { results: ReturnType<typeof allResults>; basePath: string }) {
  return (
    <div className="rounded-lg border border-line bg-paper px-3 py-2.5 text-[12.5px]">
      <div className="mb-1.5 font-semibold">Maximumprinzip</div>
      {(Object.keys(results) as Goal[]).map((g) => {
        const r = results[g];
        return (
          <Link key={g} to={`${basePath}/${g}`} className="flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-primary-50/60">
            <span className="text-muted">{GOAL_LABEL[g]}</span>
            <span className="flex items-center gap-1.5">
              {r.override && <span className="text-[11px] text-muted">übersteuert</span>}
              <LevelPill level={r.effective} />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
