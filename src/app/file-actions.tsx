import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ImportBundleDialog } from "../components/ImportBundle";
import { ImportXlsxDialog } from "../components/ImportXlsx";
import { NewAssetDialog } from "../components/NewAssetDialog";
import type { AssessmentVersion } from "../domain/types";
import { BundleError, FILE_ACCEPT, readBundleFile, type ParsedBundle } from "../io/json";
import { exportAssessment, exportBackup, exportOds, exportPdf, exportSettings, exportXlsx, pickFile } from "./files";
import { useSession } from "./session";

/** Everything the "Datei" menu can do; the dialogs live here so the menu works on every page. */
interface FileActions {
  /** The analysis version currently open in the workspace, if any. */
  current: AssessmentVersion | null;
  setCurrent: (v: AssessmentVersion | null) => void;
  newAnalysis: () => void;
  openFile: () => Promise<void>;
  importSheet: () => void;
  saveCurrent: () => Promise<void>;
  saveAll: () => Promise<void>;
  saveSettings: () => Promise<void>;
  exportReport: (format: "pdf" | "xlsx" | "ods") => Promise<void>;
}

const Ctx = createContext<FileActions | null>(null);

export function useFileActions(): FileActions {
  const c = useContext(Ctx);
  if (!c) throw new Error("FileActionsProvider missing");
  return c;
}

/** Registers the version shown in the workspace as the target of "Als Datei speichern" and exports. */
export function useCurrentVersion(v: AssessmentVersion | null | undefined) {
  const { setCurrent } = useFileActions();
  useEffect(() => {
    setCurrent(v ?? null);
    return () => setCurrent(null);
  }, [v, setCurrent]);
}

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MOD_LABEL = isMac ? "⌘" : "Strg+";

interface LaunchQueue {
  setConsumer(consumer: (params: { files?: { getFile(): Promise<File> }[] }) => void): void;
}

export function FileActionsProvider({ children }: { children: ReactNode }) {
  const { actor, notify, guard, requireIdentity } = useSession();
  const [current, setCurrent] = useState<AssessmentVersion | null>(null);
  const [creating, setCreating] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bundle, setBundle] = useState<ParsedBundle | null>(null);

  const openBytes = useCallback(
    async (file: File) => {
      try {
        setBundle(await readBundleFile(await file.arrayBuffer()));
      } catch (e) {
        notify(e instanceof BundleError ? e.message : "Die Datei konnte nicht geöffnet werden.", "error");
      }
    },
    [notify],
  );

  const openFile = useCallback(async () => {
    const file = await pickFile(FILE_ACCEPT);
    if (file) await openBytes(file);
  }, [openBytes]);

  const saveAll = useCallback(async () => {
    await guard(() => exportBackup(actor));
  }, [guard, actor]);

  const saveCurrent = useCallback(async () => {
    if (!current) return saveAll();
    await guard(() => exportAssessment(current, actor));
  }, [current, guard, actor, saveAll]);

  const exportReport = useCallback(
    async (format: "pdf" | "xlsx" | "ods") => {
      if (!current) return;
      // Reports print the author's name.
      const name = await requireIdentity();
      if (!name) return;
      const fn = format === "pdf" ? exportPdf : format === "xlsx" ? exportXlsx : exportOds;
      await guard(() => fn(current));
    },
    [current, requireIdentity, guard],
  );

  // Desktop conventions: Cmd/Ctrl+S saves, Cmd/Ctrl+O opens.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(isMac ? e.metaKey : e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        void (e.shiftKey ? saveAll() : saveCurrent());
      } else if (key === "o" && !e.shiftKey) {
        e.preventDefault();
        void openFile();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveAll, saveCurrent, openFile]);

  // .sba files opened from the operating system (installed app, Chromium File Handling API).
  useEffect(() => {
    const queue = (window as unknown as { launchQueue?: LaunchQueue }).launchQueue;
    queue?.setConsumer(async (params) => {
      const handle = params.files?.[0];
      if (handle) await openBytes(await handle.getFile());
    });
  }, [openBytes]);

  const value = useMemo<FileActions>(
    () => ({
      current,
      setCurrent,
      newAnalysis: () => setCreating(true),
      openFile,
      importSheet: () => setSheetOpen(true),
      saveCurrent,
      saveAll,
      saveSettings: async () => void (await guard(() => exportSettings(actor))),
      exportReport,
    }),
    [current, openFile, saveCurrent, saveAll, guard, actor, exportReport],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <NewAssetDialog open={creating} onClose={() => setCreating(false)} />
      <ImportXlsxDialog open={sheetOpen} onClose={() => setSheetOpen(false)} />
      <ImportBundleDialog bundle={bundle} onClose={() => setBundle(null)} />
    </Ctx.Provider>
  );
}
