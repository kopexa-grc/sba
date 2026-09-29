import { Download, FileJson, FileSpreadsheet, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAssetList, type AssetRow } from "../app/data";
import { exportJson, pickFile } from "../app/files";
import { useSession } from "../app/session";
import { ImportXlsxDialog } from "../components/ImportXlsx";
import { StatusBadge } from "../components/StatusBadge";
import { TriadChips } from "../components/level";
import { Badge, Button, Dialog, Empty, Field, Input, Select, cn } from "../components/ui";
import { repo } from "../db/repo";
import { allResults, progress } from "../domain/scoring";
import { ASSET_TYPE_LABEL, STATUS_LABEL, type AssetType, type VersionStatus } from "../domain/types";
import { versionLabel } from "../domain/versioning";
import { BundleError, parseBundle, type ParsedBundle } from "../io/json";
import { formatDate } from "../lib/format";

export function Dashboard() {
  const rows = useAssetList();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<VersionStatus | "all">("all");
  const [creating, setCreating] = useState(false);
  const [xlsxOpen, setXlsxOpen] = useState(false);
  const [bundle, setBundle] = useState<ParsedBundle | null>(null);
  const { actor, notify, guard } = useSession();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (status !== "all" && r.latest.status !== status) return false;
      if (!q) return true;
      const m = r.latest.meta;
      return [m.name, m.owner, m.orgUnit, m.assessor, ASSET_TYPE_LABEL[m.type]].some((s) => s.toLowerCase().includes(q));
    });
  }, [rows, query, status]);

  async function openBundle() {
    const file = await pickFile(".json,application/json");
    if (!file) return;
    try {
      setBundle(await parseBundle(await file.text()));
    } catch (e) {
      notify(e instanceof BundleError ? e.message : "Die Datei konnte nicht gelesen werden.", "error");
    }
  }

  if (rows === undefined) return null;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:py-8">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] leading-tight font-bold">Schutzbedarfsanalysen</h1>
          <p className="mt-1 max-w-2xl text-[13.5px] text-muted">
            Je Asset eine Analyse: Vertraulichkeit, Integrität und Verfügbarkeit werden über sechs Schadensszenarien
            bewertet und nach dem Maximumprinzip zusammengeführt.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<FileSpreadsheet className="size-4" />} onClick={() => setXlsxOpen(true)}>
            Excel importieren
          </Button>
          <Button icon={<FileJson className="size-4" />} onClick={openBundle}>
            Sicherung einlesen
          </Button>
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            Neue Analyse
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-8">
          <Empty
            title="Noch keine Analysen in diesem Browser"
            action={
              <>
                <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
                  Erste Analyse anlegen
                </Button>
                <Button icon={<FileSpreadsheet className="size-4" />} onClick={() => setXlsxOpen(true)}>
                  Bestehenden Excel-Bogen übernehmen
                </Button>
              </>
            }
          >
            Legen Sie eine Analyse für ein Asset an oder übernehmen Sie einen ausgefüllten Erhebungsbogen
            (FS_Schutzbedarfsanalyse.xlsx). Die Daten werden nur lokal gespeichert.
          </Empty>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
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
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              icon={<Download className="size-4" />}
              onClick={() => guard(() => exportJson(undefined, actor, `SBA_Sicherung_${new Date().toISOString().slice(0, 10)}`))}
            >
              Alle sichern (.sba.json)
            </Button>
          </div>
          <AssetTable rows={filtered} />
        </>
      )}

      <NewAssetDialog open={creating} onClose={() => setCreating(false)} />
      <ImportXlsxDialog open={xlsxOpen} onClose={() => setXlsxOpen(false)} />
      <BundleDialog bundle={bundle} onClose={() => setBundle(null)} />
    </div>
  );
}

function AssetTable({ rows }: { rows: AssetRow[] }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-line bg-paper">
      <div className="hidden grid-cols-[minmax(0,2.2fr)_auto_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)] gap-4 border-b border-line bg-surface px-4 py-2 text-[11.5px] font-semibold tracking-wide text-muted uppercase md:grid">
        <span>Asset</span>
        <span className="w-[92px]">V · I · A</span>
        <span>Version</span>
        <span>Fortschritt</span>
        <span>Zuletzt geändert</span>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r) => {
          const v = r.latest;
          const p = progress(v);
          const pct = Math.round((p.answered / p.total) * 100);
          return (
            <li key={r.assetId}>
              <Link
                to={`/a/${r.assetId}/v/${v.id}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-primary-50/60 md:grid-cols-[minmax(0,2.2fr)_auto_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold">{v.meta.name || "Unbenanntes Asset"}</span>
                  <span className="block truncate text-[12.5px] text-muted">
                    {ASSET_TYPE_LABEL[v.meta.type]}
                    {v.meta.owner && <> · {v.meta.owner}</>}
                  </span>
                </span>
                <span className="w-[92px]">
                  <TriadChips results={allResults(v)} />
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="neutral" className="tabular">
                    v{versionLabel(v)}
                  </Badge>
                  <StatusBadge status={v.status} />
                  {r.approved && r.approved.id !== v.id && (
                    <Badge tone="success" className="tabular">
                      gültig: v{versionLabel(r.approved)}
                    </Badge>
                  )}
                </span>
                <span className="flex items-center gap-2 text-[12.5px] text-muted tabular">
                  <span className="h-1.5 w-20 overflow-hidden rounded-full bg-line">
                    <span
                      className={cn("block h-full rounded-full", pct === 100 ? "bg-lvl-1" : "bg-primary-500")}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  {p.answered}/{p.total}
                </span>
                <span className="text-[12.5px] text-muted tabular">
                  {formatDate(v.updatedAt)}
                  <span className="block truncate">{v.updatedBy.replace(/ <.*>$/, "")}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-muted">Keine Analyse passt zum Filter.</p>}
    </div>
  );
}

function NewAssetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { actor, identity, guard } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [type, setType] = useState<AssetType>("application");
  const [owner, setOwner] = useState("");

  async function create() {
    const v = await guard(() => repo.createAsset(actor, { name: name.trim(), type, owner: owner.trim(), assessor: identity?.name ?? "" }));
    if (!v) return;
    setName("");
    setOwner("");
    onClose();
    navigate(`/a/${v.assetId}/v/${v.id}`);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Neue Schutzbedarfsanalyse"
      description="Pro Asset eine Analyse – so bleibt jede Einstufung einzeln nachvollziehbar."
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={create}>
            Analyse anlegen
          </Button>
        </>
      }
    >
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create();
        }}
      >
        <Field label="Asset-Bezeichnung" required>
          {(id) => (
            <Input id={id} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. SAP S/4HANA Core, Kunden-CRM" />
          )}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Asset-Typ">
            {(id) => (
              <Select id={id} value={type} onChange={(e) => setType(e.target.value as AssetType)}>
                {(Object.keys(ASSET_TYPE_LABEL) as AssetType[]).map((t) => (
                  <option key={t} value={t}>
                    {ASSET_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Asset-Owner">
            {(id) => <Input id={id} value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Name / Abteilung" />}
          </Field>
        </div>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

function BundleDialog({ bundle, onClose }: { bundle: ParsedBundle | null; onClose: () => void }) {
  const { notify, guard } = useSession();
  const versions = bundle?.records.reduce((n, r) => n + r.versions.length, 0) ?? 0;
  return (
    <Dialog
      open={!!bundle}
      onClose={onClose}
      title="Sicherung einlesen"
      description="Vorhandene Analysen und Versionen mit gleicher Kennung werden nicht überschrieben."
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button
            variant="primary"
            onClick={async () => {
              if (!bundle) return;
              const res = await guard(() => repo.importRecords(bundle.records));
              if (!res) return;
              onClose();
              notify(
                `${res.assets} Analysen und ${res.versions} Versionen übernommen${res.skipped ? `, ${res.skipped} bereits vorhanden` : ""}.`,
              );
            }}
          >
            Übernehmen
          </Button>
        </>
      }
    >
      {bundle && (
        <div className="grid gap-3 text-[13.5px]">
          <p>
            Die Datei enthält <strong>{bundle.records.length} Analysen</strong> mit insgesamt <strong>{versions} Versionen</strong>{" "}
            samt Audit-Trail.
          </p>
          <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-md border border-line">
            {bundle.records.map((r) => {
              const last = r.versions[r.versions.length - 1];
              return (
                <li key={r.asset.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="truncate">{last?.meta.name || "Unbenannt"}</span>
                  <span className="text-[12px] text-muted tabular">{r.versions.length} Version(en)</span>
                </li>
              );
            })}
          </ul>
          {bundle.tampered.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-[13px] text-red-800">
              <strong>Achtung:</strong> Bei {bundle.tampered.length} freigegebenen Version(en) stimmt der Inhalt nicht mit
              dem Freigabe-Siegel überein ({bundle.tampered.map((t) => t.name || "Unbenannt").join(", ")}). Die Datei wurde
              nach der Freigabe verändert. Die Versionen werden mit Warnhinweis übernommen.
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
