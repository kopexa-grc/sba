import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { actorLabel, ANONYMOUS_ACTOR, repo, type Identity } from "../db/repo";
import { Button, Dialog, Field, Input } from "../components/ui";

interface Toast {
  id: number;
  text: string;
  tone: "info" | "error";
}

interface Session {
  identity: Identity | null;
  /** Display string used as actor in the change log ("Ohne Namen" until a name is set). */
  actor: string;
  editIdentity: () => void;
  /**
   * Resolves with the actor label once a name is known, or null if the user
   * cancels. Asks for the name if needed – used before closing a version or
   * exporting a report, where the name is printed.
   */
  requireIdentity: () => Promise<string | null>;
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
  const [dialog, setDialog] = useState<"edit" | "required" | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pending = useRef<((actor: string | null) => void) | null>(null);

  useEffect(() => {
    repo.getIdentity().then(setIdentity);
  }, []);

  const notify = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 8000 : 4000);
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

  const requireIdentity = useCallback(() => {
    if (identity) return Promise.resolve(actorLabel(identity));
    setDialog("required");
    return new Promise<string | null>((resolve) => {
      pending.current = resolve;
    });
  }, [identity]);

  function finish(actor: string | null) {
    setDialog(null);
    pending.current?.(actor);
    pending.current = null;
  }

  if (identity === undefined) return null;

  return (
    <Ctx.Provider
      value={{
        identity,
        actor: identity ? actorLabel(identity) : ANONYMOUS_ACTOR,
        editIdentity: () => setDialog("edit"),
        requireIdentity,
        notify,
        guard,
      }}
    >
      {children}
      <IdentityDialog
        open={dialog !== null}
        required={dialog === "required"}
        initial={identity}
        onCancel={() => finish(null)}
        onSave={async (id) => {
          await repo.setIdentity(id);
          // Changes made before a name was known belong to the same person.
          if (!identity) await repo.claimAnonymous(actorLabel(id));
          setIdentity(id);
          finish(actorLabel(id));
          notify("Name gespeichert.");
        }}
      />
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-2">
          {toasts
            .filter((t) => t.tone === "info")
            .map((t) => (
              <div key={t.id} className="pointer-events-auto max-w-md rounded-md bg-primary-950 px-3.5 py-2 text-[13.5px] text-white shadow-lg">
                {t.text}
              </div>
            ))}
        </div>
        <div role="alert" aria-live="assertive" className="flex flex-col items-center gap-2">
          {toasts
            .filter((t) => t.tone === "error")
            .map((t) => (
              <div key={t.id} className="pointer-events-auto max-w-md rounded-md bg-red-700 px-3.5 py-2 text-[13.5px] text-white shadow-lg">
                {t.text}
              </div>
            ))}
        </div>
      </div>
    </Ctx.Provider>
  );
}

function IdentityDialog({
  open,
  required,
  initial,
  onSave,
  onCancel,
}: {
  open: boolean;
  required: boolean;
  initial: Identity | null;
  onSave: (id: Identity) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setEmail(initial?.email ?? "");
    }
  }, [open, initial]);
  const emailValid = email === "" || /.+@.+\..+/.test(email);
  const valid = name.trim().length > 1 && emailValid;
  const submit = () => valid && onSave({ name: name.trim(), email: email.trim() });
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={required ? "Ihr Name für Bericht und Änderungsprotokoll" : "Ihre Angaben"}
      description={
        required
          ? "Der Name erscheint im Bericht und im Änderungsprotokoll. Er wird nur in diesem Browser gespeichert."
          : "Name und E-Mail erscheinen im Bericht und im Änderungsprotokoll. Sie werden nur in diesem Browser gespeichert."
      }
      footer={
        <>
          <Button onClick={onCancel}>Abbrechen</Button>
          <Button variant="primary" disabled={!valid} onClick={submit}>
            Speichern
          </Button>
        </>
      }
    >
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Name" required>
          {(id) => (
            <Input id={id} value={name} autoFocus autoComplete="name" onChange={(e) => setName(e.target.value)} placeholder="Vorname Nachname" />
          )}
        </Field>
        <Field label="E-Mail" hint="Optional" error={emailValid ? null : "Bitte eine gültige E-Mail-Adresse eingeben."}>
          {(id) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@firma.de"
            />
          )}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
