import { useEffect, useState } from "react";
import { Link } from "react-router";
import { exportJson } from "../app/files";
import { useSession } from "../app/session";
import { Button, Dialog, Field, Input } from "../components/ui";
import { db } from "../db/db";
import { SCHEMA_VERSION } from "../io/json";

function useStorage() {
  const [info, setInfo] = useState<{ usage?: number; quota?: number; persisted?: boolean }>({});
  const refresh = async () => {
    const est = await navigator.storage?.estimate?.();
    const persisted = await navigator.storage?.persisted?.();
    setInfo({ usage: est?.usage, quota: est?.quota, persisted });
  };
  useEffect(() => {
    refresh();
  }, []);
  return { info, refresh };
}

function mb(bytes?: number) {
  return bytes === undefined ? "–" : `${(bytes / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
}

export function SettingsPage() {
  const { identity, editIdentity, actor, notify, guard } = useSession();
  const { info, refresh } = useStorage();
  const [wipe, setWipe] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  return (
    <div className="mx-auto grid max-w-3xl gap-8 px-4 py-8 sm:px-6">
      <h1 className="text-[24px] font-semibold">Einstellungen</h1>

      <section className="border-t border-line pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold">Angaben für Audit-Trail und Freigaben</div>
            <div className="text-[13.5px] text-muted">
              {identity?.name}
              {identity?.email && <> · {identity.email}</>}
            </div>
          </div>
          <Button onClick={editIdentity}>Ändern</Button>
        </div>
      </section>

      <section className="border-t border-line pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold">Lokaler Speicher</div>
            <div className="text-[13.5px] text-muted">
              Belegt {mb(info.usage)} von {mb(info.quota)} ·{" "}
              {info.persisted ? "dauerhaft gespeichert" : "Browser darf Daten bei Speichermangel entfernen"}
            </div>
          </div>
          {!info.persisted && (
            <Button
              onClick={async () => {
                const ok = await navigator.storage?.persist?.();
                await refresh();
                notify(ok ? "Speicher ist jetzt dauerhaft." : "Der Browser hat die dauerhafte Speicherung abgelehnt. Installieren Sie die App oder sichern Sie regelmäßig.");
              }}
            >
              Dauerhaft speichern
            </Button>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() => guard(() => exportJson(undefined, actor, `SBA_Sicherung_${new Date().toISOString().slice(0, 10)}`))}
          >
            Alle Analysen sichern
          </Button>
          <Button variant="danger" onClick={() => setWipe(true)}>
            Alle Daten löschen …
          </Button>
        </div>
      </section>

      <section className="border-t border-line pt-6 text-[13.5px] text-muted">
        <div className="mb-1 text-[15px] font-semibold text-ink">Über</div>
        Kopexa Schutzbedarfsanalyse · Datenformat {SCHEMA_VERSION} · Methodik nach BSI-Standard 200-2 und ISO/IEC 27001.
        Alle Berechnungen, Speicherung und Dateierzeugung laufen ausschließlich im Browser.{" "}
        <Link to="/styleguide" className="text-primary-700 hover:underline">
          Styleguide
        </Link>
      </section>

      <Dialog
        open={wipe}
        onClose={() => setWipe(false)}
        title="Alle Daten in diesem Browser löschen?"
        description="Sämtliche Analysen, Versionen und Audit-Trails werden unwiderruflich entfernt. Sichern Sie vorher als .sba.json."
        footer={
          <>
            <Button onClick={() => setWipe(false)}>Abbrechen</Button>
            <Button
              variant="danger"
              disabled={confirmText !== "LÖSCHEN"}
              onClick={async () => {
                await guard(() => db.transaction("rw", db.assets, db.versions, db.audit, () => Promise.all([db.assets.clear(), db.versions.clear(), db.audit.clear()])));
                setWipe(false);
                setConfirmText("");
                notify("Alle Analysen wurden gelöscht.");
              }}
            >
              Endgültig löschen
            </Button>
          </>
        }
      >
        <Field label="Zur Bestätigung LÖSCHEN eingeben">
          {(id) => <Input id={id} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />}
        </Field>
      </Dialog>
    </div>
  );
}
