import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAssetList, type AssetRow } from "../app/data";
import { exportJson, pickFile } from "../app/files";
import { useSession } from "../app/session";
import { ImportXlsxDialog } from "../components/ImportXlsx";
import { StatusText } from "../components/StatusBadge";
import { TriadMarks } from "../components/level";
import { Button, Dialog, Empty, Field, Input, Notice, Select, cn } from "../components/ui";
import { repo } from "../db/repo";
import { allResults, progress } from "../domain/scoring";
import { ASSET_TYPE_LABEL, STATUS_LABEL, type AssetType, type VersionStatus } from "../domain/types";
import { versionLabel } from "../domain/versioning";
import { BundleError, parseBundle, type ParsedBundle } from "../io/json";
import { actorName, formatDate } from "../lib/format";

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
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] leading-tight font-semibold">Schutzbedarfsanalysen</h1>
          <p className="mt-1 max-w-2xl text-[14px] text-muted">
            Eine Analyse je Asset, bewertet nach BSI-Standard 200-2.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setXlsxOpen(true)}>
            Excel importieren
          </Button>
          <Button onClick={openBundle}>
            Sicherung einlesen
          </Button>
          <Button variant="primary" onClick={() => setCreating(true)}>
            Neue Analyse
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <Empty
            title="Noch keine Analysen"
            action={
              <>
                <Button variant="primary" onClick={() => setCreating(true)}>
                  Analyse anlegen
                </Button>
                <Button onClick={() => setXlsxOpen(true)}>
                  Excel-Bogen übernehmen
                </Button>
              </>
            }
          >
            Legen Sie eine Analyse an oder übernehmen Sie einen ausgefüllten Excel-Erhebungsbogen. Gespeichert wird nur in
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
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => guard(() => exportJson(undefined, actor, `SBA_Sicherung_${new Date().toISOString().slice(0, 10)}`))}
            >
              Alle sichern
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
  const th = "px-3 py-2 text-left text-[12.5px] font-normal text-muted first:pl-2";
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[720px] text-[13.5px]">
        <thead className="border-b border-line">
          <tr>
            <th className={th}>Asset</th>
            <th className={th}>Schutzbedarf</th>
            <th className={th}>Version</th>
            <th className={cn(th, "text-right")}>Bewertet</th>
            <th className={th}>Geändert</th>
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
                  {r.approved && r.approved.id !== v.id && (
                    <div className="text-[12.5px] text-muted tabular">gültig: {versionLabel(r.approved)}</div>
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
          <ul className="max-h-48 divide-y divide-line overflow-y-auto border-y border-line">
            {bundle.records.map((r) => {
              const last = r.versions[r.versions.length - 1];
              return (
                <li key={r.asset.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate">{last?.meta.name || "Unbenannt"}</span>
                  <span className="text-[12px] text-muted tabular">{r.versions.length} Version(en)</span>
                </li>
              );
            })}
          </ul>
          {bundle.tampered.length > 0 && (
            <Notice tone="error">
              Bei {bundle.tampered.length} freigegebenen Version(en) stimmt der Inhalt nicht mit
              dem Freigabe-Siegel überein ({bundle.tampered.map((t) => t.name || "Unbenannt").join(", ")}). Die Datei wurde
              nach der Freigabe verändert. Die Versionen werden übernommen und als verletzt angezeigt.
            </Notice>
          )}
        </div>
      )}
    </Dialog>
  );
}
