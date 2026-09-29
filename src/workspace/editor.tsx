import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useSession } from "../app/session";
import { Button, Dialog, Field, Input, Textarea } from "../components/ui";
import { repo } from "../db/repo";
import type { Change } from "../domain/diff";
import type { AssessmentVersion } from "../domain/types";

interface Editor {
  version: AssessmentVersion;
  readOnly: boolean;
  /** Applies an audited change. Asks for a reason when an existing rating changes. */
  update: (mutate: (v: AssessmentVersion) => void) => Promise<void>;
}

const Ctx = createContext<Editor | null>(null);

export function useEditor(): Editor {
  const e = useContext(Ctx);
  if (!e) throw new Error("EditorProvider missing");
  return e;
}

interface Pending {
  changes: Change[];
  resolve: (reason: string | null) => void;
}

export function EditorProvider({ version, children }: { version: AssessmentVersion; children: ReactNode }) {
  const { actor, guard } = useSession();
  const [pending, setPending] = useState<Pending | null>(null);
  const readOnly = version.status !== "draft";

  async function update(mutate: (v: AssessmentVersion) => void) {
    if (readOnly) return;
    await guard(async () => {
      const changes = await repo.previewReclassifications(version.id, mutate);
      let reason: string | undefined;
      if (changes.length > 0) {
        const r = await new Promise<string | null>((resolve) => setPending({ changes, resolve }));
        setPending(null);
        if (r === null) return;
        reason = r;
      }
      await repo.updateDraft(version.id, actor, mutate, reason);
    });
  }

  return (
    <Ctx.Provider value={{ version, readOnly, update }}>
      {children}
      <ReasonDialog pending={pending} />
    </Ctx.Provider>
  );
}

function ReasonDialog({ pending }: { pending: Pending | null }) {
  const [reason, setReason] = useState("");
  useEffect(() => setReason(""), [pending]);
  const ratings = pending?.changes ?? [];
  return (
    <Dialog
      open={!!pending}
      onClose={() => pending?.resolve(null)}
      title="Änderungsgrund dokumentieren"
      description="Höher- und Herabstufungen werden mit Begründung im Audit-Trail festgehalten."
      footer={
        <>
          <Button onClick={() => pending?.resolve(null)}>Abbrechen</Button>
          <Button variant="primary" disabled={reason.trim().length < 5} onClick={() => pending?.resolve(reason.trim())}>
            Änderung speichern
          </Button>
        </>
      }
    >
      <ul className="mb-4 grid gap-1.5">
        {ratings.map((c) => (
          <li key={c.path} className="rounded-md border border-line bg-surface px-3 py-2 text-[13px]">
            <div className="font-medium">{c.label}</div>
            <div className="text-muted">
              {c.oldValue ?? "–"} →{" "}
              <strong className={c.kind === "escalated" ? "text-red-700" : "text-emerald-700"}>{c.newValue ?? "–"}</strong>
            </div>
          </li>
        ))}
      </ul>
      <Field label="Änderungsgrund" required hint="z. B. „Einführung von Gesundheitsdaten nach Art. 9 DSGVO“">
        {(id) => <Textarea id={id} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />}
      </Field>
    </Dialog>
  );
}

/**
 * Text input that saves after a short typing pause, on blur and when the page
 * is hidden (tab switch, close). The repository merges consecutive edits of the
 * same field into one change-log entry.
 */
export function CommitInput({
  value,
  onCommit,
  multiline,
  rows,
  ...rest
}: {
  value: string;
  onCommit: (v: string) => void;
  multiline?: boolean;
  rows?: number;
  id?: string;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
}) {
  const { readOnly } = useEditor();
  const [local, setLocal] = useState(value);
  const focused = useRef(false);
  const latest = useRef({ local, value, onCommit });
  latest.current = { local, value, onCommit };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const { local: l, value: v, onCommit: commit } = latest.current;
    if (l !== v) commit(l);
  }, []);

  useEffect(() => {
    if (!focused.current) setLocal(value);
  }, [value]);

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  const change = (next: string) => {
    setLocal(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 1200);
  };

  const common = {
    ...rest,
    value: local,
    readOnly,
    onFocus: () => {
      focused.current = true;
    },
    onBlur: () => {
      focused.current = false;
      flush();
    },
  };
  return multiline ? (
    <Textarea {...common} rows={rows ?? 3} onChange={(e) => change(e.target.value)} />
  ) : (
    <Input {...common} onChange={(e) => change(e.target.value)} />
  );
}
