import { X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { useSession } from "../app/session";
import { repo } from "../db/repo";
import {
  buildImportRows,
  detectHeaderRow,
  distinctValues,
  emptyMapping,
  suggestMapping,
  suggestTypeMapping,
  TARGET_FIELDS,
  toTable,
  type ColumnMapping,
  type ImportRow,
  type TargetField,
} from "../domain/asset-import";
import { emptyRow, parsePastedAssets, rowsToCreate, type CaptureRow } from "../domain/quick-capture";
import { ASSET_TYPE_LABEL, type AssetMeta, type AssetType } from "../domain/types";
import type { RawSheet } from "../io/table-read";
import { Button, Dialog, Field, Input, Notice, Select, cn } from "./ui";

type Tab = "manual" | "file";
const TYPES = Object.keys(ASSET_TYPE_LABEL) as AssetType[];
const norm = (s: string) => s.trim().toLowerCase();

/** "Assets erfassen": several analyses at once – typed/pasted, or imported from CSV/Excel/ODS with column mapping. */
export function AssetCaptureDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("manual");
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const { actor, notify, guard } = useSession();
  const navigate = useNavigate();
  const tabsId = useId();

  useEffect(() => {
    if (!open) return;
    setTab("manual");
    repo.assetNames().then((n) => setExisting(new Set(n.map(norm))));
  }, [open]);

  async function create(metas: Partial<AssetMeta>[], source?: string) {
    const created = await guard(() => repo.createAssets(actor, metas, source));
    if (!created) return;
    onClose();
    notify(`${created.length} ${created.length === 1 ? "Analyse" : "Analysen"} angelegt.`);
    navigate("/");
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "manual", label: "Eingeben" },
    { id: "file", label: "Aus Datei importieren" },
  ];
  const onTabKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = tab === "manual" ? "file" : "manual";
    setTab(next);
    document.getElementById(`${tabsId}-${next}`)?.focus();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Assets erfassen"
      description="Legt für jedes Asset eine eigene Analyse im Entwurf an. Bewertet wird anschließend wie gewohnt."
    >
      <div role="tablist" aria-label="Art der Erfassung" className="-mt-1 mb-4 flex gap-1 border-b border-line" onKeyDown={onTabKey}>
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`${tabsId}-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`${tabsId}-${t.id}-panel`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-[13.5px]",
              tab === t.id ? "border-primary-950 font-medium text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${tabsId}-${tab}-panel`} aria-labelledby={`${tabsId}-${tab}`}>
        {tab === "manual" ? (
          <ManualCapture existing={existing} onCancel={onClose} onCreate={(rows) => create(rows)} />
        ) : (
          <FileImport existing={existing} onCancel={onClose} onCreate={create} />
        )}
      </div>
    </Dialog>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">{children}</div>;
}

// Manual entry

function ManualCapture({
  existing,
  onCancel,
  onCreate,
}: {
  existing: Set<string>;
  onCancel: () => void;
  onCreate: (rows: CaptureRow[]) => void;
}) {
  const [rows, setRows] = useState<CaptureRow[]>([emptyRow(), emptyRow(), emptyRow()]);
  const nameRefs = useRef<(HTMLInputElement | null)[]>([]);
  const focusRow = useRef<number | null>(null);
  const valid = rowsToCreate(rows);
  const clashes = valid.filter((r) => existing.has(norm(r.name)));

  useEffect(() => {
    if (focusRow.current !== null) {
      nameRefs.current[focusRow.current]?.focus();
      focusRow.current = null;
    }
  });

  const update = (i: number, patch: Partial<CaptureRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function onPaste(i: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text/plain");
    if (!/[\n\t]/.test(text.trim())) return;
    e.preventDefault();
    const pasted = parsePastedAssets(text, rows[i]!.type);
    setRows((rs) => {
      const before = rs.slice(0, i);
      const after = rs.slice(i + 1).filter((r) => r.name.trim());
      return [...before, ...pasted, ...after, emptyRow()];
    });
    focusRow.current = i + pasted.length;
  }

  function onEnter(i: number, e: KeyboardEvent<HTMLElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (i === rows.length - 1) setRows((rs) => [...rs, emptyRow(rs[i]!.type)]);
    focusRow.current = i + 1;
  }

  return (
    <div>
      <p className="mb-3 text-[13px] text-muted">
        Eine Zeile je Asset. Enter springt in die nächste Zeile. Listen aus Excel oder LibreOffice lassen sich direkt in die erste
        Spalte einfügen – Spalten Bezeichnung, Typ, Owner.
      </p>
      <div className="overflow-x-auto" role="region" aria-label="Erfasste Assets" tabIndex={0}>
        <table className="w-full min-w-[560px] text-[13.5px]">
          <thead className="border-b border-line">
            <tr>
              <th scope="col" className="w-8 py-2 pr-2 text-left text-[12.5px] font-normal text-muted">
                #
              </th>
              <th scope="col" className="py-2 pr-2 text-left text-[12.5px] font-normal text-muted">
                Bezeichnung
              </th>
              <th scope="col" className="w-44 py-2 pr-2 text-left text-[12.5px] font-normal text-muted">
                Typ
              </th>
              <th scope="col" className="w-44 py-2 pr-2 text-left text-[12.5px] font-normal text-muted">
                Owner
              </th>
              <th scope="col" className="w-8">
                <span className="sr-only">Entfernen</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const exists = r.name.trim() && existing.has(norm(r.name));
              return (
                <tr key={i}>
                  <td className="py-1 pr-2 text-muted tabular">{i + 1}</td>
                  <td className="py-1 pr-2">
                    <Input
                      ref={(el) => {
                        nameRefs.current[i] = el;
                      }}
                      aria-label={`Bezeichnung, Zeile ${i + 1}`}
                      aria-invalid={exists ? true : undefined}
                      value={r.name}
                      placeholder={i === 0 ? "z. B. Kunden-CRM" : undefined}
                      onChange={(e) => update(i, { name: e.target.value })}
                      onPaste={(e) => onPaste(i, e)}
                      onKeyDown={(e) => onEnter(i, e)}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Select aria-label={`Typ, Zeile ${i + 1}`} value={r.type} onChange={(e) => update(i, { type: e.target.value as AssetType })}>
                      {TYPES.map((t) => (
                        <option key={t} value={t}>
                          {ASSET_TYPE_LABEL[t]}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      aria-label={`Owner, Zeile ${i + 1}`}
                      value={r.owner}
                      onChange={(e) => update(i, { owner: e.target.value })}
                      onKeyDown={(e) => onEnter(i, e)}
                    />
                  </td>
                  <td className="py-1">
                    <button
                      type="button"
                      aria-label={`Zeile ${i + 1} entfernen`}
                      disabled={rows.length === 1}
                      onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                      className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-ink disabled:opacity-40"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2">
        <Button size="sm" variant="ghost" onClick={() => setRows((rs) => [...rs, emptyRow(rs.at(-1)?.type)])}>
          Zeile hinzufügen
        </Button>
      </div>
      {clashes.length > 0 && (
        <Notice tone="warning" className="mt-3">
          Bereits vorhanden: {clashes.map((c) => c.name).join(", ")}. Diese werden trotzdem als weitere Analyse angelegt.
        </Notice>
      )}
      <Footer>
        <Button onClick={onCancel}>Abbrechen</Button>
        <Button variant="primary" disabled={valid.length === 0} onClick={() => onCreate(valid)}>
          {valid.length === 1 ? "1 Analyse anlegen" : `${valid.length} Analysen anlegen`}
        </Button>
      </Footer>
    </div>
  );
}

// Import from file with column mapping

type Step = "file" | "map" | "preview";

function FileImport({
  existing,
  onCancel,
  onCreate,
}: {
  existing: Set<string>;
  onCancel: () => void;
  onCreate: (metas: Partial<AssetMeta>[], source: string) => void;
}) {
  const { notify } = useSession();
  const [step, setStep] = useState<Step>("file");
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<RawSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(true);
  const [mapping, setMapping] = useState<ColumnMapping>(emptyMapping());
  const [typeMap, setTypeMap] = useState<Record<string, AssetType | null>>({});
  const [defaultType, setDefaultType] = useState<AssetType>("application");
  const [includeExisting, setIncludeExisting] = useState(false);
  const [busy, setBusy] = useState(false);

  const sheet = sheets[sheetIndex];
  const table = useMemo(() => (sheet ? toTable(sheet, headerRow) : null), [sheet, headerRow]);
  const typeValues = useMemo(
    () => (table && mapping.type !== null ? distinctValues(table, mapping.type) : []),
    [table, mapping.type],
  );
  const rows: ImportRow[] = useMemo(
    () => (table ? buildImportRows(table, mapping, typeMap, { defaultType, existingNames: existing }) : []),
    [table, mapping, typeMap, defaultType, existing],
  );
  const toCreate = rows.filter((r) => r.status === "new" || (includeExisting && r.status === "exists"));

  // Fresh suggestions whenever the table changes (other sheet, header toggle).
  useEffect(() => {
    if (!table) return;
    const m = suggestMapping(table);
    setMapping(m);
    setTypeMap(m.type !== null ? suggestTypeMapping(distinctValues(table, m.type)) : {});
  }, [table]);

  async function load(file: File) {
    setBusy(true);
    try {
      const { readTableFile } = await import("../io/table-read");
      const read = await readTableFile(file.name, await file.arrayBuffer());
      if (read.length === 0 || read.every((s) => s.rows.length === 0)) throw new Error("Die Datei enthält keine Daten.");
      const first = Math.max(0, read.findIndex((s) => s.rows.length > 0));
      setSheets(read);
      setSheetIndex(first);
      setHeaderRow(detectHeaderRow(read[first]!));
      setFileName(file.name);
      setStep("map");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Die Datei konnte nicht gelesen werden.", "error");
    } finally {
      setBusy(false);
    }
  }

  const columnLabel = (i: number) => {
    const sample = table?.rows.find((r) => r[i]?.trim())?.[i] ?? "";
    const head = table?.headers[i] ?? `Spalte ${i + 1}`;
    return sample && sample !== head ? `${head} – z. B. „${sample.slice(0, 40)}“` : head;
  };

  if (step === "file") {
    return (
      <div>
        <p className="text-[13.5px]">
          Eine Tabelle mit einer Zeile je Asset: CSV (Komma, Semikolon oder Tab), Excel (.xlsx) oder OpenDocument (.ods). Welche
          Spalte welches Feld enthält, legen Sie im nächsten Schritt fest.
        </p>
        <label className="mt-4 inline-flex">
          <span className="inline-flex h-8 cursor-pointer items-center rounded-md border border-line px-3 text-[13.5px] font-medium hover:bg-surface">
            {busy ? "Datei wird gelesen …" : "Datei auswählen"}
          </span>
          <input
            type="file"
            className="sr-only"
            accept=".csv,.tsv,.txt,.xlsx,.ods,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) load(f);
            }}
          />
        </label>
        <Footer>
          <Button onClick={onCancel}>Abbrechen</Button>
        </Footer>
      </div>
    );
  }

  if (step === "map" && table) {
    const used = new Map<number, TargetField>();
    for (const f of TARGET_FIELDS) {
      const c = mapping[f.field];
      if (c !== null) used.set(c, f.field);
    }
    return (
      <div className="grid gap-5">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <p className="min-w-0 flex-1 text-[13.5px]">
            <span className="font-medium">{fileName}</span>
            <span className="text-muted">
              {" "}
              · {table.rows.length} Zeilen · {table.headers.length} Spalten
            </span>
          </p>
          {sheets.length > 1 && (
            <Field label="Tabellenblatt" className="w-56">
              {(id) => (
                <Select id={id} value={sheetIndex} onChange={(e) => setSheetIndex(Number(e.target.value))}>
                  {sheets.map((s, i) => (
                    <option key={i} value={i}>
                      {s.name} ({s.rows.length} Zeilen)
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
        </div>
        <label className="flex items-center gap-2 text-[13.5px]">
          <input type="checkbox" className="size-3.5 accent-primary-950" checked={headerRow} onChange={(e) => setHeaderRow(e.target.checked)} />
          Erste Zeile enthält Spaltennamen
        </label>

        <fieldset className="min-w-0">
          <legend className="mb-2 text-[14px] font-semibold">Spalten zuordnen</legend>
          <div className="divide-y divide-line border-y border-line">
            {TARGET_FIELDS.map((f) => (
              <div key={f.field} className="grid items-center gap-2 py-2 sm:grid-cols-[220px_minmax(0,1fr)]">
                <label htmlFor={`map-${f.field}`} className="text-[13.5px]">
                  {f.label}
                  {f.required && <span className="ml-1.5 text-muted">(Pflicht)</span>}
                </label>
                <Select
                  id={`map-${f.field}`}
                  value={mapping[f.field] ?? ""}
                  aria-invalid={f.required && mapping[f.field] === null ? true : undefined}
                  onChange={(e) => {
                    const col = e.target.value === "" ? null : Number(e.target.value);
                    setMapping((m) => {
                      const next = { ...m };
                      // A column feeds one field only.
                      for (const k of Object.keys(next) as TargetField[]) if (col !== null && next[k] === col) next[k] = null;
                      next[f.field] = col;
                      return next;
                    });
                    if (f.field === "type") setTypeMap(col === null ? {} : suggestTypeMapping(distinctValues(table, col)));
                  }}
                >
                  <option value="">– nicht zuordnen –</option>
                  {table.headers.map((_, i) => (
                    <option key={i} value={i}>
                      {columnLabel(i)}
                      {used.has(i) && used.get(i) !== f.field ? " (belegt)" : ""}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-3">
          <Field label="Typ, wenn keiner angegeben ist" className="max-w-xs">
            {(id) => (
              <Select id={id} value={defaultType} onChange={(e) => setDefaultType(e.target.value as AssetType)}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ASSET_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {typeValues.length > 0 && (
            <fieldset className="min-w-0">
              <legend className="mb-1 text-[14px] font-semibold">Werte der Spalte „Typ“ zuordnen</legend>
              <p className="mb-2 text-[13px] text-muted">Erkannte Werte sind vorbelegt; nicht zugeordnete erhalten den Standardtyp.</p>
              <div className="divide-y divide-line border-y border-line">
                {typeValues.map((val) => (
                  <div key={val} className="grid items-center gap-2 py-1.5 sm:grid-cols-[220px_minmax(0,1fr)]">
                    <label htmlFor={`type-${val}`} className="truncate text-[13.5px]" title={val}>
                      „{val}“
                    </label>
                    <Select
                      id={`type-${val}`}
                      value={typeMap[val] ?? ""}
                      onChange={(e) => setTypeMap((m) => ({ ...m, [val]: e.target.value ? (e.target.value as AssetType) : null }))}
                    >
                      <option value="">Standardtyp ({ASSET_TYPE_LABEL[defaultType]})</option>
                      {TYPES.map((t) => (
                        <option key={t} value={t}>
                          {ASSET_TYPE_LABEL[t]}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        {mapping.name === null && <Notice tone="error">Ordnen Sie der Bezeichnung eine Spalte zu.</Notice>}
        <Footer>
          <Button
            variant="ghost"
            onClick={() => {
              setStep("file");
              setSheets([]);
            }}
          >
            Andere Datei
          </Button>
          <Button variant="primary" disabled={mapping.name === null} onClick={() => setStep("preview")}>
            Weiter zur Vorschau
          </Button>
        </Footer>
      </div>
    );
  }

  // Preview
  const count = (s: ImportRow["status"]) => rows.filter((r) => r.status === s).length;
  const STATUS: Record<ImportRow["status"], string> = {
    new: "Neu",
    exists: "Bereits vorhanden",
    "duplicate-in-file": "Doppelt in der Datei",
    invalid: "Fehlerhaft",
  };
  return (
    <div className="grid gap-4">
      <p className="text-[13.5px]">
        {count("new")} neu
        {count("exists") > 0 && <> · {count("exists")} bereits vorhanden</>}
        {count("duplicate-in-file") > 0 && <> · {count("duplicate-in-file")} doppelt</>}
        {count("invalid") > 0 && <> · {count("invalid")} ohne Bezeichnung</>}
      </p>
      {count("exists") > 0 && (
        <label className="flex items-center gap-2 text-[13.5px]">
          <input
            type="checkbox"
            className="size-3.5 accent-primary-950"
            checked={includeExisting}
            onChange={(e) => setIncludeExisting(e.target.checked)}
          />
          Bereits vorhandene trotzdem als weitere Analyse anlegen
        </label>
      )}
      <div className="max-h-[45vh] overflow-auto" role="region" aria-label="Vorschau der Zeilen" tabIndex={0}>
        <table className="w-full min-w-[560px] text-[13px]">
          <thead className="sticky top-0 border-b border-line bg-paper">
            <tr>
              {["Zeile", "Bezeichnung", "Typ", "Owner", "Status"].map((h) => (
                <th key={h} scope="col" className="py-2 pr-3 text-left text-[12.5px] font-normal text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.slice(0, 200).map((r) => {
              const skipped = !(r.status === "new" || (includeExisting && r.status === "exists"));
              return (
                <tr key={r.line} className={cn(skipped && "text-muted")}>
                  <td className="py-1.5 pr-3 tabular">{r.line}</td>
                  <td className="py-1.5 pr-3">{r.meta.name || "–"}</td>
                  <td className="py-1.5 pr-3">{ASSET_TYPE_LABEL[r.meta.type]}</td>
                  <td className="py-1.5 pr-3">{r.meta.owner || "–"}</td>
                  <td className={cn("py-1.5 pr-3", r.status === "invalid" && "text-red-700")}>
                    {STATUS[r.status]}
                    {skipped && r.status !== "new" ? " – wird übersprungen" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length > 200 && <p className="py-2 text-[12.5px] text-muted">… und {rows.length - 200} weitere Zeilen.</p>}
      </div>
      <Footer>
        <Button variant="ghost" onClick={() => setStep("map")}>
          Zurück zur Zuordnung
        </Button>
        <Button variant="primary" disabled={toCreate.length === 0} onClick={() => onCreate(toCreate.map((r) => r.meta), fileName)}>
          {toCreate.length === 1 ? "1 Analyse anlegen" : `${toCreate.length} Analysen anlegen`}
        </Button>
      </Footer>
    </div>
  );
}
