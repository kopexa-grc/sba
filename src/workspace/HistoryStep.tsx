import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { StatusText } from "../components/StatusBadge";
import { TriadMarks } from "../components/level";
import { Input, Select, cn } from "../components/ui";
import { allResults } from "../domain/scoring";
import type { AssessmentVersion, AuditAction, AuditEntry } from "../domain/types";
import { versionLabel } from "../domain/versioning";
import { actorName, formatDateTime } from "../lib/format";

export const ACTION_LABEL: Record<AuditAction, string> = {
  create: "Angelegt",
  update: "Geändert",
  close: "Abgeschlossen",
  branch: "Neue Version",
  import: "Importiert",
  "delete-draft": "Entwurf verworfen",
};

const TH = "px-3 py-2 text-left text-[12.5px] font-normal text-muted first:pl-0";
const TD = "px-3 py-2.5 align-top first:pl-0";

export function HistoryStep({
  versions,
  audit,
  current,
}: {
  versions: AssessmentVersion[];
  audit: AuditEntry[];
  current: AssessmentVersion;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
      <div>
        <h2 data-focus-heading className="text-[20px] font-semibold focus:outline-none">Historie &amp; Änderungsprotokoll</h2>
        <p className="mt-0.5 text-[14px] text-muted">
          Jede Änderung mit Zeitpunkt (UTC), Akteur, altem und neuem Wert sowie Grund. Einträge lassen sich nicht ändern.
        </p>
      </div>

      <section>
        <h3 className="mb-2 text-[15px] font-semibold">Versionen</h3>
        <ol className="divide-y divide-line border-y border-line">
          {[...versions].reverse().map((v) => (
            <li key={v.id}>
              <Link
                to={`/a/${v.assetId}/v/${v.id}`}
                className={cn(
                  "grid grid-cols-[88px_minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 px-2 py-3 hover:bg-surface",
                  v.id === current.id && "bg-surface",
                )}
              >
                <span className="text-[14px] font-semibold tabular">{versionLabel(v)}</span>
                <span className="min-w-0 text-[13.5px]">
                  <span className="block">{v.changeSummary || "Ohne Beschreibung"}</span>
                  <span className="mt-0.5 flex flex-wrap gap-x-1.5 text-[12.5px] text-muted">
                    <StatusText status={v.status} />
                    <span>· erstellt {formatDateTime(v.createdAt)}, {actorName(v.createdBy)}</span>
                    {v.closedAt && <span>· abgeschlossen {formatDateTime(v.closedAt)}, {actorName(v.closedBy ?? "")}</span>}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-muted">
                    Bewertungsschema: {v.scheme.name} (Stand {v.scheme.revision})
                  </span>
                </span>
                <TriadMarks results={allResults(v)} />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <AuditTable audit={audit} />
    </div>
  );
}

function AuditTable({ audit }: { audit: AuditEntry[] }) {
  const [q, setQ] = useState("");
  const [action, setAction] = useState<AuditAction | "all">("all");
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return audit.filter(
      (a) =>
        (action === "all" || a.action === action) &&
        (!s || [a.field, a.oldValue, a.newValue, a.reason, a.actor].some((x) => x?.toLowerCase().includes(s))),
    );
  }, [audit, q, action]);

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-[15px] font-semibold">
          Änderungsprotokoll <span className="font-normal text-muted tabular">{rows.length}</span>
        </h3>
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen" className="pl-8" aria-label="Änderungsprotokoll durchsuchen" />
        </div>
        <Select value={action} onChange={(e) => setAction(e.target.value as AuditAction | "all")} className="w-auto" aria-label="Aktion">
          <option value="all">Alle Aktionen</option>
          {(Object.keys(ACTION_LABEL) as AuditAction[]).map((a) => (
            <option key={a} value={a}>
              {ACTION_LABEL[a]}
            </option>
          ))}
        </Select>
      </div>
      <div role="region" aria-label="Änderungsprotokoll" tabIndex={0} className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead className="border-b border-line">
            <tr>
              <th scope="col" className={TH}>Zeitpunkt (UTC)</th>
              <th scope="col" className={TH}>Version</th>
              <th scope="col" className={TH}>Akteur</th>
              <th scope="col" className={TH}>Aktion</th>
              <th scope="col" className={TH}>Vorher → Nachher</th>
              <th scope="col" className={TH}>Grund</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((a) => (
              <tr key={a.id}>
                <td className={cn(TD, "whitespace-nowrap text-muted tabular")} title={a.at}>
                  {a.at.replace("T", " ").slice(0, 19)}
                </td>
                <td className={cn(TD, "whitespace-nowrap tabular")}>{a.versionLabel}</td>
                <td className={TD}>{actorName(a.actor)}</td>
                <td className={TD}>
                  {ACTION_LABEL[a.action]}
                  {a.field && <div className="text-muted">{a.field}</div>}
                </td>
                <td className={cn(TD, "max-w-[260px] break-words")}>
                  {a.oldValue || a.newValue ? (
                    <>
                      <span className="text-muted">{a.oldValue ?? "leer"}</span> → {a.newValue ?? "leer"}
                    </>
                  ) : (
                    <span className="text-muted">–</span>
                  )}
                </td>
                <td className={cn(TD, "max-w-[240px] break-words")}>{a.reason ?? <span className="text-muted">–</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-6 text-[13px] text-muted">Keine Einträge für diesen Filter.</p>}
      </div>
    </section>
  );
}
