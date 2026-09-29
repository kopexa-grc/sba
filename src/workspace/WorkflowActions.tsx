import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { exportAssessment, exportOds, exportPdf, exportXlsx } from "../app/files";
import { useSession } from "../app/session";
import { Button, Dialog, Field, Segmented, Textarea, cn } from "../components/ui";
import { repo } from "../db/repo";
import { hasBlockingIssues } from "../domain/scoring";
import type { AssessmentVersion } from "../domain/types";
import { nextNumber, versionLabel } from "../domain/versioning";

type Pending = "close" | "branch" | "discard" | "delete" | null;

export function WorkflowActions({
  version,
  versions,
  onBlocked,
}: {
  version: AssessmentVersion;
  versions: AssessmentVersion[];
  onBlocked: () => void;
}) {
  const [pending, setPending] = useState<Pending>(null);
  const { actor, notify, guard, requireIdentity } = useSession();
  /** Reports and closing print the author's name, so ask for it first. */
  const withName = async (fn: (actor: string) => Promise<unknown>) => {
    const name = await requireIdentity();
    if (name) await guard(() => fn(name));
  };
  const navigate = useNavigate();
  const [summary, setSummary] = useState("");
  const [kind, setKind] = useState<"minor" | "major">("minor");
  useEffect(() => setSummary(""), [pending]);

  const openDraft = versions.find((v) => v.status === "draft");
  const next = nextNumber(versions, version, kind);
  const close = () => setPending(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {version.status === "draft" && (
        <Button
          variant="primary"
          data-tour="close-version"
          onClick={async () => {
            if (hasBlockingIssues(version)) return onBlocked();
            if (await requireIdentity()) setPending("close");
          }}
        >
          Version abschließen
        </Button>
      )}
      {version.status === "final" && !openDraft && (
        <Button variant="primary" onClick={() => setPending("branch")}>
          Neue Version anlegen
        </Button>
      )}
      {version.status === "final" && openDraft && (
        <Button onClick={() => navigate(`/a/${openDraft.assetId}/v/${openDraft.id}`)}>
          Zur Version {versionLabel(openDraft)}
        </Button>
      )}

      <Menu
        label="Export"
        items={[
          { label: "PDF-Bericht", onSelect: () => withName(() => exportPdf(version)) },
          { label: "Prüfbericht für Excel (.xlsx)", onSelect: () => withName(() => exportXlsx(version)) },
          { label: "Prüfbericht für LibreOffice / openDesk (.ods)", onSelect: () => withName(() => exportOds(version)) },
          { label: "Analyse als Datei (.sba)", onSelect: () => guard(() => exportAssessment(version, actor)) },
          ...(version.status === "draft" && version.parentVersionId
            ? [{ label: "Version verwerfen …", onSelect: () => setPending("discard"), danger: true }]
            : []),
          { label: "Analyse löschen …", onSelect: () => setPending("delete"), danger: true },
        ]}
      />

      <Dialog
        open={pending === "close"}
        onClose={close}
        title={`Version ${version.major}.${version.minor} abschließen`}
        description="Die Version wird schreibgeschützt und gilt als Stand der Analyse. Spätere Änderungen erfolgen in einer neuen Version, die mit dieser verglichen werden kann."
        footer={
          <>
            <Button onClick={close}>Abbrechen</Button>
            <Button
              variant="primary"
              onClick={async () => {
                const name = await requireIdentity();
                if (!name) return;
                const ok = await guard(() => repo.close(version.id, name));
                if (!ok) return;
                close();
                notify(`Version ${version.major}.${version.minor} abgeschlossen.`);
              }}
            >
              Abschließen
            </Button>
          </>
        }
      />

      <Dialog
        open={pending === "branch"}
        onClose={close}
        title="Neue Version anlegen"
        description={`Version ${versionLabel(version)} bleibt unverändert erhalten. Die neue Version übernimmt alle Angaben und das aktuelle Bewertungsschema.`}
        footer={
          <>
            <Button onClick={close}>Abbrechen</Button>
            <Button
              variant="primary"
              disabled={summary.trim().length < 3}
              onClick={async () => {
                const created = await guard(() => repo.branch(version.id, actor, kind, summary.trim()));
                if (!created) return;
                close();
                navigate(`/a/${created.assetId}/v/${created.id}/stammdaten`);
                notify(`Version ${versionLabel(created)} angelegt.`);
              }}
            >
              Version {next.major}.{next.minor} anlegen
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Umfang der Änderung">
            {() => (
              <Segmented
                label="Umfang der Änderung"
                value={kind}
                onChange={setKind}
                options={[
                  { value: "minor", label: "Kleine Änderung" },
                  { value: "major", label: "Neubewertung" },
                ]}
              />
            )}
          </Field>
          <Field label="Anlass" required hint="z. B. „Jährliche Überprüfung“ oder „Einführung von Gesundheitsdaten“">
            {(id) => <Textarea id={id} autoFocus rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} />}
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={pending === "discard"}
        onClose={close}
        title="Version verwerfen?"
        description="Die Version in Bearbeitung wird gelöscht; die vorherige Version bleibt erhalten. Das Verwerfen wird im Änderungsprotokoll vermerkt."
        footer={
          <>
            <Button onClick={close}>Abbrechen</Button>
            <Button
              variant="danger"
              onClick={async () => {
                const parent = await guard(() => repo.discardDraft(version.id, actor));
                if (!parent) return;
                close();
                navigate(`/a/${version.assetId}/v/${parent}`);
                notify("Version verworfen.");
              }}
            >
              Verwerfen
            </Button>
          </>
        }
      />

      <Dialog
        open={pending === "delete"}
        onClose={close}
        title="Analyse endgültig löschen?"
        description={
          <>
            Alle {versions.length} Versionen und das Änderungsprotokoll von „{version.meta.name || "Unbenannt"}“ werden aus
            diesem Browser entfernt. Exportieren Sie die Analyse vorher als Datei, wenn Sie sie aufbewahren möchten.
          </>
        }
        footer={
          <>
            <Button onClick={close}>Abbrechen</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await guard(() => repo.deleteAsset(version.assetId));
                close();
                navigate("/");
                notify("Analyse gelöscht.");
              }}
            >
              Endgültig löschen
            </Button>
          </>
        }
      />
    </div>
  );
}

interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

/** Menu button following the WAI-ARIA menu pattern (arrow keys, Home/End, Escape, Tab). */
function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) button.current?.focus();
  }

  function onMenuKey(e: React.KeyboardEvent) {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    const move = (i: number) => itemRefs.current[(i + items.length) % items.length]?.focus();
    if (e.key === "ArrowDown") move(current + 1);
    else if (e.key === "ArrowUp") move(current - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(items.length - 1);
    else if (e.key === "Escape") close(true);
    else if (e.key === "Tab") return close(false);
    else return;
    e.preventDefault();
  }

  return (
    <div ref={ref} className="relative" data-tour="export">
      <Button
        ref={button}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {label}
        <ChevronDown className="size-3.5" aria-hidden />
      </Button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className="absolute right-0 z-40 mt-1 w-72 rounded-md border border-line bg-paper py-1 shadow-[0_8px_24px_-8px_rgb(16_38_62/0.22)]"
        >
          {items.map((it, i) => (
            <button
              key={it.label}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              role="menuitem"
              type="button"
              tabIndex={-1}
              onClick={() => {
                close(true);
                it.onSelect();
              }}
              className={cn(
                "flex w-full px-3 py-1.5 text-left text-[13.5px] hover:bg-surface focus-visible:bg-surface focus-visible:outline-offset-[-2px]",
                it.danger && "text-red-700",
                it.danger && !items[i - 1]?.danger && "mt-1 border-t border-line pt-2",
              )}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
