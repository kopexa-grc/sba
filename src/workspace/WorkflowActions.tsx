import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { exportJson, exportPdf, exportXlsx, baseName } from "../app/files";
import { useSession } from "../app/session";
import { Button, Dialog, Field, Notice, Segmented, Textarea, cn } from "../components/ui";
import { repo } from "../db/repo";
import { hasBlockingIssues } from "../domain/scoring";
import type { AssessmentVersion } from "../domain/types";
import { nextNumber, versionLabel } from "../domain/versioning";
import { actorName } from "../lib/format";

type Pending = "submit" | "reject" | "approve" | "branch" | "discard" | "delete" | null;

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
  const { actor, identity, notify, guard } = useSession();
  const navigate = useNavigate();
  const [comment, setComment] = useState("");
  const [kind, setKind] = useState<"minor" | "major">("minor");
  useEffect(() => setComment(""), [pending]);

  const openDraft = versions.find((v) => v.status === "draft" || v.status === "review");
  const close = () => setPending(null);
  const selfApproval = version.submitted && identity && actorName(version.submitted.by) === identity.name;

  async function run(fn: () => Promise<unknown>, message: string) {
    const ok = await guard(async () => {
      await fn();
      return true;
    });
    if (ok) {
      close();
      notify(message);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {version.status === "draft" && (
        <Button
          variant="primary"
          onClick={() => (hasBlockingIssues(version) ? onBlocked() : setPending("submit"))}
        >
          Zur Prüfung einreichen
        </Button>
      )}
      {version.status === "review" && (
        <>
          <Button onClick={() => setPending("reject")}>
            Zurückweisen
          </Button>
          <Button variant="primary" onClick={() => setPending("approve")}>
            Freigeben
          </Button>
        </>
      )}
      {(version.status === "approved" || version.status === "archived") && !openDraft && (
        <Button variant="primary" onClick={() => setPending("branch")}>
          Neue Version anlegen
        </Button>
      )}
      {(version.status === "approved" || version.status === "archived") && openDraft && (
        <Button onClick={() => navigate(`/a/${openDraft.assetId}/v/${openDraft.id}`)}>
          Zur Arbeitsversion {versionLabel(openDraft)}
        </Button>
      )}

      <Menu
        label="Export"
        items={[
          {
            label: "PDF-Bericht",
            onSelect: () => guard(() => exportPdf(version)),
          },
          {
            label: "Excel-Prüfbericht",
            onSelect: () => guard(() => exportXlsx(version)),
          },
          {
            label: "Datensicherung (JSON)",
            onSelect: () => guard(() => exportJson([version.assetId], actor, baseName(version))),
          },
          ...(version.status === "draft" && version.parentVersionId
            ? [{ label: "Arbeitsversion verwerfen", onSelect: () => setPending("discard"), danger: true }]
            : []),
          { label: "Analyse löschen …", onSelect: () => setPending("delete"), danger: true },
        ]}
      />

      <Dialog
        open={pending === "submit"}
        onClose={close}
        title={`Version ${versionLabel(version)} einreichen`}
        description="Die Version wird schreibgeschützt und als „fachlich freigegeben“ vermerkt. Die prüfende Stelle (z. B. CISO, ISB, DSB) kann sie freigeben oder mit Kommentar zurückweisen."
        footer={
          <>
            <Button onClick={close}>Abbrechen</Button>
            <Button variant="primary" onClick={() => run(() => repo.submit(version.id, actor, comment.trim() || undefined), "Zur Prüfung eingereicht.")}>
              Einreichen
            </Button>
          </>
        }
      >
        <Field label="Hinweis für die Prüfung" hint="Optional">
          {(id) => <Textarea id={id} value={comment} onChange={(e) => setComment(e.target.value)} />}
        </Field>
      </Dialog>

      <Dialog
        open={pending === "reject"}
        onClose={close}
        title="Zur Überarbeitung zurückweisen"
        description="Die Version geht als Entwurf zurück. Der Kommentar wird im Audit-Trail festgehalten."
        footer={
          <>
            <Button onClick={close}>Abbrechen</Button>
            <Button
              variant="primary"
              disabled={comment.trim().length < 5}
              onClick={() => run(() => repo.reject(version.id, actor, comment.trim()), "Zur Überarbeitung zurückgewiesen.")}
            >
              Zurückweisen
            </Button>
          </>
        }
      >
        <Field label="Was muss überarbeitet werden?" required>
          {(id) => <Textarea id={id} autoFocus value={comment} onChange={(e) => setComment(e.target.value)} />}
        </Field>
      </Dialog>

      <Dialog
        open={pending === "approve"}
        onClose={close}
        title={`Version ${version.major}.${version.minor} freigeben`}
        description="Nach der Freigabe sind alle Felder schreibgeschützt. Über den Inhalt wird ein SHA-256-Hash gebildet, mit dem sich spätere Manipulationen nachweisen lassen. Eine bisher gültige Version wird archiviert."
        footer={
          <>
            <Button onClick={close}>Abbrechen</Button>
            <Button
              variant="primary"
              onClick={() => run(() => repo.approve(version.id, actor, comment.trim() || undefined), "Freigegeben und versiegelt.")}
            >
              Freigeben
            </Button>
          </>
        }
      >
        {selfApproval && (
          <Notice tone="warning" className="mb-4">
            Sie haben diese Version selbst eingereicht. Nach dem Vier-Augen-Prinzip sollte eine andere Person freigeben.
          </Notice>
        )}
        <Field label="Freigabevermerk" hint="Optional, z. B. Rolle und Geltungsdauer der Freigabe.">
          {(id) => <Textarea id={id} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Freigegeben als CISO …" />}
        </Field>
      </Dialog>

      <Dialog
        open={pending === "branch"}
        onClose={close}
        title="Neue Version anlegen"
        description={`Die freigegebene Version ${versionLabel(version)} bleibt unverändert gültig, bis die neue Version freigegeben ist.`}
        footer={
          <>
            <Button onClick={close}>Abbrechen</Button>
            <Button
              variant="primary"
              disabled={comment.trim().length < 3}
              onClick={async () => {
                const next = await guard(() => repo.branch(version.id, actor, kind, comment.trim()));
                if (!next) return;
                close();
                navigate(`/a/${next.assetId}/v/${next.id}/stammdaten`);
                notify(`Arbeitsversion ${versionLabel(next)} angelegt.`);
              }}
            >
              Version anlegen
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[13px]">
              <div className="font-medium">Art der Änderung</div>
              <div className="text-muted">
                Neue Version {nextNumber(versions, version, kind).major}.{nextNumber(versions, version, kind).minor}
              </div>
            </div>
            <Segmented
              label="Art der Änderung"
              value={kind}
              onChange={setKind}
              options={[
                { value: "minor", label: "Minor" },
                { value: "major", label: "Major" },
              ]}
            />
          </div>
          <Field label="Anlass" required hint="z. B. „Jährliche Rezertifizierung“ oder „Einführung Gesundheitsdaten“">
            {(id) => <Textarea id={id} autoFocus rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />}
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={pending === "discard"}
        onClose={close}
        title="Arbeitsversion verwerfen?"
        description="Die Arbeitsversion wird gelöscht; die zugrunde liegende Version bleibt erhalten. Das Verwerfen wird im Audit-Trail vermerkt."
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
                notify("Arbeitsversion verworfen.");
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
            Alle {versions.length} Versionen und der vollständige Audit-Trail von „{version.meta.name || "Unbenannt"}“ werden aus
            diesem Browser entfernt. Sichern Sie die Analyse vorher als .sba.json, wenn sie aufbewahrt werden muss.
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
        <div role="menu" className="absolute right-0 z-40 mt-1 w-60 rounded-md border border-line bg-paper py-1 shadow-[0_8px_24px_-8px_rgb(16_38_62/0.22)]">
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
