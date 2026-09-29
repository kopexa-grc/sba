import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { StatusBadge } from "../components/StatusBadge";
import { TriadChips } from "../components/level";
import { Input, Select, cn } from "../components/ui";
import { allResults } from "../domain/scoring";
import type { AssessmentVersion, AuditAction, AuditEntry } from "../domain/types";
import { versionLabel } from "../domain/versioning";
import { actorName, formatDateTime } from "../lib/format";

export const ACTION_LABEL: Record<AuditAction, string> = {
  create: "Angelegt",
  update: "Geändert",
  submit: "Zur Prüfung eingereicht",
  reject: "Zurückgewiesen",
  approve: "Freigegeben & versiegelt",
  branch: "Neue Version",
  supersede: "Abgelöst",
  archive: "Archiviert",
  import: "Importiert",
  "delete-draft": "Entwurf verworfen",
};

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
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div>
        <h2 className="text-[21px] font-bold">Historie &amp; Audit-Trail</h2>
        <p className="mt-0.5 text-[13.5px] text-muted">
          Jede Änderung wird unveränderlich protokolliert – mit Zeitstempel (UTC), Akteur, altem und neuem Wert sowie Grund.
        </p>
      </div>
      <section>
        <h3 className="mb-2 text-[14px] font-semibold">Versionen</h3>
        <ol className="overflow-hidden rounded-lg border border-line bg-paper">
          {[...versions].reverse().map((v) => (
            <li key={v.id} className={cn("border-b border-line last:border-b-0", v.id === current.id && "bg-primary-50/50")}>
              <Link
                to={`/a/${v.assetId}/v/${v.id}`}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-primary-50/60"
              >
                <span className="font-display text-[17px] font-bold tabular">v{versionLabel(v)}</span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={v.status} />
                    <span className="truncate text-[13px]">{v.changeSummary || "–"}</span>
                  </span>
                  <span className="mt-0.5 block text-[12px] text-muted">
                    Erstellt {formatDateTime(v.createdAt)} von {actorName(v.createdBy)}
                    {v.approved && (
                      <>
                        {" "}
                        · freigegeben {formatDateTime(v.approved.at)} von {actorName(v.approved.by)}
                      </>
                    )}
                  </span>
                  {v.hash && <span className="mt-0.5 block truncate font-mono text-[11px] text-muted">SHA-256 {v.hash}</span>}
                </span>
                <TriadChips results={allResults(v)} />
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
        <h3 className="mr-auto text-[14px] font-semibold">Audit-Trail</h3>
        <div className="relative w-full sm:w-60">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Feld, Wert, Grund …" className="pl-8" aria-label="Audit-Trail durchsuchen" />
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
      <div className="overflow-x-auto rounded-lg border border-line bg-paper">
        <table className="w-full min-w-[760px] text-left text-[12.5px]">
          <thead className="bg-surface text-[11px] tracking-wide text-muted uppercase">
            <tr>
              <th className="px-3 py-2 font-semibold">Zeitpunkt (UTC)</th>
              <th className="px-3 py-2 font-semibold">Version</th>
              <th className="px-3 py-2 font-semibold">Akteur</th>
              <th className="px-3 py-2 font-semibold">Aktion / Feld</th>
              <th className="px-3 py-2 font-semibold">Alt → Neu</th>
              <th className="px-3 py-2 font-semibold">Grund</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="px-3 py-2 whitespace-nowrap text-muted tabular" title={a.at}>
                  {a.at.replace("T", " ").slice(0, 19)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap tabular">v{a.versionLabel}</td>
                <td className="px-3 py-2">{actorName(a.actor)}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">{ACTION_LABEL[a.action]}</div>
                  {a.field && <div className="text-muted">{a.field}</div>}
                </td>
                <td className="max-w-[260px] px-3 py-2">
                  {a.oldValue || a.newValue ? (
                    <span className="break-words">
                      <span className="text-muted line-through decoration-muted/50">{a.oldValue ?? "–"}</span>
                      {" → "}
                      <span>{a.newValue ?? "–"}</span>
                    </span>
                  ) : (
                    <span className="text-muted">–</span>
                  )}
                </td>
                <td className="max-w-[260px] px-3 py-2 break-words">{a.reason ?? <span className="text-muted">–</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-3 py-6 text-center text-[13px] text-muted">Keine Einträge.</p>}
      </div>
    </section>
  );
}
