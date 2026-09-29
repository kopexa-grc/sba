import { Ellipsis } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "../app/session";
import { DropdownContent, DropdownItem, DropdownRoot, DropdownTrigger } from "../components/menu";
import { Button, Dialog, Field, Segmented, Textarea } from "../components/ui";
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

      <DropdownRoot modal={false}>
        <DropdownTrigger asChild>
          <Button aria-label="Weitere Aktionen" title="Weitere Aktionen" className="w-8 px-0">
            <Ellipsis className="size-4" aria-hidden />
          </Button>
        </DropdownTrigger>
        <DropdownContent>
          {version.status === "draft" && version.parentVersionId && (
            <DropdownItem danger onSelect={() => setPending("discard")}>
              Version verwerfen …
            </DropdownItem>
          )}
          <DropdownItem danger onSelect={() => setPending("delete")}>
            Analyse löschen …
          </DropdownItem>
        </DropdownContent>
      </DropdownRoot>

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
