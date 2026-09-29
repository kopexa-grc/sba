import { Search } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAssetList, type AssetRow } from "../app/data";
import { useFileActions } from "../app/file-actions";
import { useSession } from "../app/session";
import { OVERVIEW_TOUR, Tour } from "../components/Tour";
import { StatusText } from "../components/StatusBadge";
import { TriadMarks } from "../components/level";
import { Button, Empty, Input, Notice, Select, cn } from "../components/ui";
import { repo } from "../db/repo";
import { allResults, progress } from "../domain/scoring";
import { ASSET_TYPE_LABEL, STATUS_LABEL, type VersionStatus } from "../domain/types";
import { versionLabel } from "../domain/versioning";
import { usePageTitle } from "../lib/a11y";
import { actorName, formatDate } from "../lib/format";

export function Dashboard() {
  usePageTitle("Analysen");
  const files = useFileActions();
  const navigate = useNavigate();
  const rows = useAssetList();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<VersionStatus | "all">("all");
  const { actor, guard } = useSession();
  const lastBackup = useLiveQuery(() => repo.lastBackupAt());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (status !== "all" && r.latest.status !== status) return false;
      if (!q) return true;
      const m = r.latest.meta;
      return [m.name, m.owner, m.orgUnit, m.assessor, ASSET_TYPE_LABEL[m.type]].some((s) => s.toLowerCase().includes(q));
    });
  }, [rows, query, status]);

  async function createSample() {
    const v = await guard(() => repo.createSample(actor));
    if (v) navigate(`/a/${v.assetId}/v/${v.id}/ergebnis`);
  }

  if (rows === undefined) return null;
  const backupDue =
    rows.length > 0 &&
    lastBackup !== undefined &&
    (lastBackup === null || Date.now() - new Date(lastBackup).getTime() > 30 * 24 * 3600 * 1000);

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] leading-tight font-semibold">Schutzbedarfsanalysen</h1>
          <p className="mt-1 max-w-2xl text-[14px] text-muted">
            Eine Analyse je Asset, bewertet nach BSI-Standard 200-2.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={files.captureAssets}>Assets erfassen</Button>
          <Button data-tour="new-analysis" variant="primary" onClick={files.newAnalysis}>
            Neue Analyse
          </Button>
        </div>
      </div>

      {backupDue && (
        <Notice tone="warning" className="mt-6">
          {lastBackup ? `Zuletzt als Datei gespeichert am ${formatDate(lastBackup)}.` : "Noch nicht als Datei gespeichert."} Ihre
          Analysen liegen nur in diesem Browser.{" "}
          <button type="button" className="text-primary-700 underline underline-offset-2" onClick={files.saveAll}>
            Jetzt als Datei speichern
          </button>
        </Notice>
      )}

      {rows.length === 0 ? (
        <div className="mt-6">
          <Empty
            title="Noch keine Analysen"
            action={
              <>
                <Button variant="primary" onClick={files.newAnalysis}>
                  Analyse anlegen
                </Button>
                <Button data-tour="sample" onClick={createSample}>
                  Beispiel ansehen
                </Button>
                <Button onClick={files.importSheet}>
                  Erhebungsbogen übernehmen
                </Button>
              </>
            }
          >
            Legen Sie eine Analyse an oder übernehmen Sie einen ausgefüllten Erhebungsbogen (Excel oder ODS). Gespeichert wird nur in
            diesem Browser.
          </Empty>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Asset, Owner, Organisationseinheit …"
                className="pl-8"
                aria-label="Analysen durchsuchen"
              />
            </div>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as VersionStatus | "all")}
              className="w-auto"
              aria-label="Nach Status filtern"
            >
              <option value="all">Alle Status</option>
              {(Object.keys(STATUS_LABEL) as VersionStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
            <span className="text-[12.5px] text-muted tabular">
              {filtered.length} von {rows.length}
            </span>
          </div>
          <AssetTable rows={filtered} />
        </>
      )}

      <Tour id="overview" steps={rows.length === 0 ? OVERVIEW_TOUR : OVERVIEW_TOUR.filter((s) => s.target !== "sample")} />
    </div>
  );
}

function AssetTable({ rows }: { rows: AssetRow[] }) {
  const th = "px-3 py-2 text-left text-[12.5px] font-normal text-muted first:pl-2";
  return (
    <div role="region" aria-label="Analysen" tabIndex={0} className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[720px] text-[13.5px]">
        <thead className="border-b border-line">
          <tr>
            <th scope="col" className={th}>Asset</th>
            <th scope="col" className={th}>Schutzbedarf</th>
            <th scope="col" className={th}>Version</th>
            <th scope="col" className={cn(th, "text-right")}>Bewertet</th>
            <th scope="col" className={th}>Geändert</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => {
            const v = r.latest;
            const p = progress(v);
            return (
              <tr key={r.assetId} className="group relative hover:bg-surface">
                <td className="py-3 pr-3 pl-2 align-top">
                  <Link to={`/a/${r.assetId}/v/${v.id}`} className="font-medium after:absolute after:inset-0">
                    {v.meta.name || "Unbenanntes Asset"}
                  </Link>
                  <div className="text-[12.5px] text-muted">
                    {ASSET_TYPE_LABEL[v.meta.type]}
                    {v.meta.owner && <> · {v.meta.owner}</>}
                  </div>
                </td>
                <td className="px-3 py-3 align-top">
                  <TriadMarks results={allResults(v)} />
                </td>
                <td className="px-3 py-3 align-top whitespace-nowrap">
                  <span className="tabular">{versionLabel(v)}</span> <StatusText status={v.status} className="text-muted" />
                  {r.lastFinal && r.lastFinal.id !== v.id && (
                    <div className="text-[12.5px] text-muted tabular">abgeschlossen: {versionLabel(r.lastFinal)}</div>
                  )}
                </td>
                <td className="px-3 py-3 text-right align-top text-muted tabular">
                  {p.answered}/{p.total}
                </td>
                <td className="px-3 py-3 align-top text-[12.5px] text-muted tabular">
                  {formatDate(v.updatedAt)}
                  <div className="truncate">{actorName(v.updatedBy)}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <p className="py-8 text-[13.5px] text-muted">Keine Analyse passt zum Filter.</p>}
    </div>
  );
}

