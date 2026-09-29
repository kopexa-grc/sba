import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { actorLabel, repo, type Identity } from "../db/repo";
import { Button, Dialog, Field, Input } from "../components/ui";

interface Toast {
  id: number;
  text: string;
  tone: "info" | "error";
}

interface Session {
  identity: Identity | null;
  /** Display string used as audit actor. */
  actor: string;
  editIdentity: () => void;
  notify: (text: string, tone?: Toast["tone"]) => void;
  /** Runs an action and turns thrown errors into an error toast. */
  guard: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
}

const Ctx = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error("SessionProvider missing");
  return s;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    repo.getIdentity().then((id) => {
      setIdentity(id);
      if (!id) setEditing(true);
    });
  }, []);

  const notify = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 3500);
  }, []);

  const guard = useCallback(
    async <T,>(fn: () => Promise<T>) => {
      try {
        return await fn();
      } catch (e) {
        notify(e instanceof Error ? e.message : String(e), "error");
        return undefined;
      }
    },
    [notify],
  );

  if (identity === undefined) return null;

  return (
    <Ctx.Provider
      value={{
        identity,
        actor: identity ? actorLabel(identity) : "unbekannt",
        editIdentity: () => setEditing(true),
        notify,
        guard,
      }}
    >
      {children}
      <IdentityDialog
        open={editing}
        initial={identity}
        onCancel={identity ? () => setEditing(false) : undefined}
        onSave={async (id) => {
          await repo.setIdentity(id);
          setIdentity(id);
          setEditing(false);
          notify("Angaben gespeichert.");
        }}
      />
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              t.tone === "error"
                ? "pointer-events-auto max-w-md rounded-md bg-red-700 px-3.5 py-2 text-[13px] text-white shadow-lg"
                : "pointer-events-auto max-w-md rounded-md bg-primary-950 px-3.5 py-2 text-[13px] text-white shadow-lg"
            }
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

function IdentityDialog({
  open,
  initial,
  onSave,
  onCancel,
}: {
  open: boolean;
  initial: Identity | null;
  onSave: (id: Identity) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setEmail(initial?.email ?? "");
    }
  }, [open, initial]);
  const valid = name.trim().length > 1 && (email === "" || /.+@.+\..+/.test(email));
  return (
    <Dialog
      open={open}
      onClose={() => onCancel?.()}
      title={initial ? "Ihre Angaben" : "Willkommen bei der Kopexa Schutzbedarfsanalyse"}
      description="Name und E-Mail erscheinen im Audit-Trail und in den Freigabevermerken. Alle Daten bleiben ausschließlich in diesem Browser."
      footer={
        <>
          {onCancel && <Button onClick={onCancel}>Abbrechen</Button>}
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => onSave({ name: name.trim(), email: email.trim() })}
          >
            Speichern
          </Button>
        </>
      }
    >
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSave({ name: name.trim(), email: email.trim() });
        }}
      >
        <Field label="Name" required>
          {(id) => <Input id={id} value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="Vorname Nachname" />}
        </Field>
        <Field label="E-Mail" hint="Optional, empfohlen für die Nachvollziehbarkeit.">
          {(id) => (
            <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@firma.de" />
          )}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
