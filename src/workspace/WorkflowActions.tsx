import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const { actor, notify, guard } = useSession();
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
        <Button variant="primary" onClick={() => (hasBlockingIssues(version) ? onBlocked() : setPending("close"))}>
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
          { label: "PDF-Bericht", onSelect: () => guard(() => exportPdf(version)) },
          { label: "Prüfbericht für Excel (.xlsx)", onSelect: () => guard(() => exportXlsx(version)) },
          { label: "Prüfbericht für LibreOffice / openDesk (.ods)", onSelect: () => guard(() => exportOds(version)) },
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
                const ok = await guard(() => repo.close(version.id, actor));
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

function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <Button aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label}
        <ChevronDown className="size-3.5" />
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-1 w-64 rounded-md border border-line bg-paper py-1 shadow-[0_8px_24px_-8px_rgb(16_38_62/0.22)]">
          {items.map((it, i) => (
            <button
              key={it.label}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
              className={cn(
                "flex w-full px-3 py-1.5 text-left text-[13.5px] hover:bg-surface",
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
