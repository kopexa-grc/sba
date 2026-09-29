import { Check, ChevronLeft, CircleAlert, Lock } from "lucide-react";
import { useEffect } from "react";
import { Link, Navigate, NavLink, useLocation, useNavigate, useParams } from "react-router";
import { useAudit, useIntegrity, useVersion, useVersions } from "../app/data";
import { useSession } from "../app/session";
import { LevelMark, ResultSummary } from "../components/level";
import { Button, Meta, Select, cn } from "../components/ui";
import { allResults, goalResult, validate } from "../domain/scoring";
import { ASSET_TYPE_LABEL, STATUS_LABEL, type Goal } from "../domain/types";
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
  const lastRejection = version.status === "draft" ? version.rejections.at(-1) : undefined;

  const done = (s: Step): boolean => {
    if (s === "C" || s === "I" || s === "A") return goalResult(version, s).complete;
    if (s === "stammdaten") return !!version.meta.name && !!version.meta.owner;
    if (s === "ergebnis") return !issues.some((i) => i.severity === "error");
    return false;
  };

  const navItem = (active: boolean) =>
    cn(
      "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] whitespace-nowrap transition-colors duration-100",
      active ? "bg-surface font-medium text-ink" : "text-muted hover:text-ink",
    );

  return (
    <EditorProvider version={version}>
      <header className="border-b border-line">
        <div className="mx-auto max-w-[1280px] px-4 pt-5 pb-4 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink">
            <ChevronLeft className="size-3.5" /> Analysen
          </Link>
          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
            <div className="min-w-0">
              <h1 className="text-[24px] leading-tight font-semibold break-words">{version.meta.name || "Unbenanntes Asset"}</h1>
              <Meta
                className="mt-2"
                items={[
                  <Select
                    key="v"
                    aria-label="Version wählen"
                    value={version.id}
                    onChange={(e) => navigate(`/a/${version.assetId}/v/${e.target.value}/${step}`)}
                    className="-ml-2 h-6 w-auto border-transparent py-0 pr-7 pl-2 text-[12.5px] font-medium text-ink hover:border-line"
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        Version {versionLabel(v)} · {STATUS_LABEL[v.status]}
                      </option>
                    ))}
                  </Select>,
                  ASSET_TYPE_LABEL[version.meta.type],
                  version.meta.owner && `Owner ${version.meta.owner}`,
                  `geändert ${formatDateTime(version.updatedAt)}, ${actorName(version.updatedBy)}`,
                ]}
              />
            </div>
            <WorkflowActions
              version={version}
              versions={versions}
              onBlocked={() => {
                notify("Vor dem Einreichen fehlen noch Pflichtangaben.", "error");
                navigate(`${basePath}/ergebnis`);
              }}
            />
          </div>

          {version.status !== "draft" && (
            <p className="mt-4 flex items-start gap-2 text-[13px]">
              <Lock className="mt-[3px] size-3.5 shrink-0 text-muted" />
              <span>
                {version.status === "review" && (
                  <>
                    Eingereicht am {formatDateTime(version.submitted?.at)} von {actorName(version.submitted?.by ?? "")}
                    {version.submitted?.comment && <> mit dem Hinweis „{version.submitted.comment}“</>}. Die Version ist bis
                    zur Entscheidung schreibgeschützt.
                  </>
                )}
                {version.status === "approved" && (
                  <>
                    Freigegeben am {formatDateTime(version.approved?.at)} von {actorName(version.approved?.by ?? "")}.
                    Änderungen sind nur über eine neue Version möglich.
                  </>
                )}
                {version.status === "archived" && (
                  <>
                    Archiviert{successor && <>, abgelöst durch Version {versionLabel(successor)}</>}. Nur noch zur
                    Nachvollziehbarkeit.
                  </>
                )}
              </span>
            </p>
          )}
          {lastRejection && (
            <p className="mt-4 flex items-start gap-2 text-[13px]">
              <CircleAlert className="mt-[3px] size-3.5 shrink-0 text-red-700" />
              <span>
                Zurückgewiesen am {formatDateTime(lastRejection.at)} von {actorName(lastRejection.by)}: „{lastRejection.comment}“
              </span>
            </p>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)] gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:py-8 xl:grid-cols-[200px_minmax(0,1fr)_260px]">
        <nav aria-label="Schritte" className="no-print lg:sticky lg:top-20 lg:self-start">
          <ol className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
            {WIZARD.map((s, i) => {
              const isGoal = s.step.length === 1;
              return (
                <li key={s.step} className="shrink-0">
                  <NavLink
                    to={`${basePath}/${s.step}`}
                    className={({ isActive }) => navItem(isActive || (s.step === "stammdaten" && !rawStep))}
                  >
                    <span className="w-3 text-[12px] text-muted tabular">
                      {done(s.step) ? <Check className="size-3.5 text-ink" aria-label="erledigt" /> : i + 1}
                    </span>
                    {s.label}
                    {isGoal && (
                      <span className="ml-auto hidden pl-3 lg:inline-flex">
                        <LevelMark level={results[s.step as Goal].effective} compact />
                      </span>
                    )}
                  </NavLink>
                </li>
              );
            })}
            <li className="mx-2.5 my-2 hidden border-t border-line lg:block" aria-hidden />
            {RECORD.map((s) => (
              <li key={s.step} className="shrink-0">
                <NavLink to={`${basePath}/${s.step}`} className={({ isActive }) => navItem(isActive)}>
                  {s.label}
                  {s.step === "historie" && <span className="ml-auto pl-3 text-[12px] text-muted tabular">{versions.length}</span>}
                </NavLink>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0">
          <div className="mb-8 xl:hidden">
            <ResultSummary results={results} integrity={integrity} hash={version.hash} approvedAt={version.approved?.at} />
          </div>
          {step === "stammdaten" && <MetaStep />}
          {(step === "C" || step === "I" || step === "A") && <GoalStep goal={step} />}
          {step === "ergebnis" && <ResultStep basePath={basePath} />}
          {step === "historie" && <HistoryStep versions={versions} audit={audit} current={version} />}
          {step === "vergleich" && <CompareStep key={version.id} versions={versions} current={version} />}

          {wizardIndex >= 0 && (
            <div className="no-print mt-10 flex items-center justify-between gap-2 border-t border-line pt-5">
              {wizardIndex > 0 ? (
                <Button variant="ghost" onClick={() => navigate(`${basePath}/${WIZARD[wizardIndex - 1]!.step}`)}>
                  Zurück: {WIZARD[wizardIndex - 1]!.label}
                </Button>
              ) : (
                <span />
              )}
              {wizardIndex < WIZARD.length - 1 && (
                <Button onClick={() => navigate(`${basePath}/${WIZARD[wizardIndex + 1]!.step}`)}>
                  Weiter: {WIZARD[wizardIndex + 1]!.label}
                </Button>
              )}
            </div>
          )}
        </div>

        <aside className="no-print hidden xl:block">
          <div className="sticky top-20 grid gap-8">
            <div>
              <h2 className="mb-1 text-[13px] font-semibold">Schutzbedarf</h2>
              <ResultSummary
                layout="rows"
                results={results}
                integrity={integrity}
                hash={version.hash}
                approvedAt={version.approved?.at}
              />
            </div>
            {version.status === "draft" && <IssueList issues={issues} basePath={basePath} compact />}
          </div>
        </aside>
      </div>
    </EditorProvider>
  );
}
