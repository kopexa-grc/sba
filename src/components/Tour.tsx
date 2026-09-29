import { X } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button, cn } from "./ui";

export interface TourStep {
  /** Value of a `data-tour` attribute; the first visible match is highlighted. Omit for a centered step. */
  target?: string;
  title: string;
  body: ReactNode;
}

export type TourId = "overview" | "workspace";

const KEY = (id: TourId) => `sba:tour:${id}`;
const START_EVENT = "sba:tour:start";

function isDone(id: TourId): boolean {
  try {
    return localStorage.getItem(KEY(id)) === "done";
  } catch {
    return false;
  }
}

function markDone(id: TourId) {
  try {
    localStorage.setItem(KEY(id), "done");
  } catch {
    // Storage may be unavailable (private mode); the tour then simply shows again.
  }
}

/** Shows all tours again the next time their page opens. */
export function resetTours() {
  for (const id of ["overview", "workspace"] as TourId[]) {
    try {
      localStorage.removeItem(KEY(id));
    } catch {
      // ignore
    }
  }
}

/** Restarts a tour that is currently mounted. */
export function startTour(id: TourId) {
  try {
    localStorage.removeItem(KEY(id));
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(START_EVENT, { detail: id }));
}

function findTarget(name: string | undefined): HTMLElement | null {
  if (!name) return null;
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`));
  return all.find((el) => el.getClientRects().length > 0) ?? null;
}

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * Guided tour: a non-modal, labelled dialog that points at one element per step.
 * Keyboard: focus moves into the dialog on every step, Escape ends the tour,
 * the page stays usable. Shown once per tour; restartable via startTour().
 */
export function Tour({ id, steps, ready = true }: { id: TourId; steps: TourStep[]; ready?: boolean }) {
  const [index, setIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (ready && !isDone(id)) {
      previousFocus.current = document.activeElement as HTMLElement | null;
      setIndex(0);
    }
  }, [id, ready]);

  useEffect(() => {
    const onStart = (e: Event) => {
      if ((e as CustomEvent<TourId>).detail !== id) return;
      previousFocus.current = document.activeElement as HTMLElement | null;
      setIndex(0);
    };
    window.addEventListener(START_EVENT, onStart);
    return () => window.removeEventListener(START_EVENT, onStart);
  }, [id]);

  const finish = useCallback(() => {
    markDone(id);
    setIndex(null);
    previousFocus.current?.focus?.();
  }, [id]);

  const step = index === null ? null : steps[index];

  // Scroll the target into view and track its position.
  useLayoutEffect(() => {
    if (!step) return;
    const target = findTarget(step.target);
    target?.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    const update = () => setRect(findTarget(step.target)?.getBoundingClientRect() ?? null);
    update();
    const t = setTimeout(update, reducedMotion() ? 0 : 350);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step]);

  // Move focus into the dialog on every step so screen readers announce it.
  useEffect(() => {
    if (step) panel.current?.focus();
  }, [step]);

  if (!step || index === null) return null;

  const last = index === steps.length - 1;
  const narrow = window.innerWidth < 640;
  const width = Math.min(360, window.innerWidth - 32);
  let style: React.CSSProperties;
  if (!rect || narrow) {
    style = narrow
      ? { left: 16, right: 16, bottom: 16 }
      : { left: "50%", top: "50%", width, transform: "translate(-50%, -50%)" };
  } else {
    const below = rect.bottom + 12 + 220 < window.innerHeight;
    const left = Math.min(Math.max(16, rect.left), window.innerWidth - width - 16);
    style = below ? { left, top: rect.bottom + 12, width } : { left, bottom: window.innerHeight - rect.top + 12, width };
  }

  return (
    <>
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-40 rounded-md ring-2 ring-primary-950 ring-offset-2 ring-offset-paper transition-[top,left,width,height] duration-200 motion-reduce:transition-none"
          style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
        />
      )}
      <div
        ref={panel}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            finish();
          }
        }}
        className={cn(
          "fixed z-50 rounded-lg border border-line bg-paper p-4 text-ink shadow-[0_16px_48px_-12px_rgb(16_38_62/0.32)] focus:outline-none",
        )}
        style={style}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[12px] text-muted tabular">
            Schritt {index + 1} von {steps.length}
          </p>
          <button
            type="button"
            onClick={finish}
            aria-label="Tour beenden"
            className="-mt-1 -mr-1 inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <h2 id={titleId} className="mt-1 text-[15px] font-semibold">
          {step.title}
        </h2>
        <div id={bodyId} className="mt-1 text-[13.5px] leading-relaxed text-ink/85">
          {step.body}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={finish}>
            Tour beenden
          </Button>
          <div className="flex gap-2">
            {index > 0 && (
              <Button size="sm" onClick={() => setIndex(index - 1)}>
                Zurück
              </Button>
            )}
            <Button size="sm" variant="primary" onClick={() => (last ? finish() : setIndex(index + 1))}>
              {last ? "Fertig" : "Weiter"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export const OVERVIEW_TOUR: TourStep[] = [
  {
    title: "Willkommen zur Schutzbedarfsanalyse",
    body: (
      <>
        Sie bewerten je Asset, welcher Schaden bei Verlust von Vertraulichkeit, Integrität oder Verfügbarkeit droht – nach
        BSI-Standard 200-2. Alles bleibt in Ihrem Browser; ein Konto brauchen Sie nicht.
      </>
    ),
  },
  {
    target: "new-analysis",
    title: "Analyse anlegen",
    body: "Eine Analyse je Asset, etwa eine Anwendung, ein Prozess oder ein Raum. Der Fragebogen führt Sie Schritt für Schritt.",
  },
  {
    target: "sample",
    title: "Erst einmal umsehen?",
    body: "Das Beispiel zeigt eine fertig ausgefüllte Analyse eines Kunden-CRM. Sie können es jederzeit wieder löschen.",
  },
  {
    target: "file-menu",
    title: "Menü „Datei“",
    body: (
      <>
        Wie in einem Desktop-Programm: Datei öffnen, Erhebungsbögen aus Excel oder LibreOffice importieren, speichern (⌘S bzw.
        Strg+S) und Berichte exportieren.
      </>
    ),
  },
  {
    target: "settings",
    title: "Einstellungen",
    body: "Hier legen Sie Schwellenwerte, Organisation und Logo fest – für neue Analysen und die Berichte.",
  },
];

export const WORKSPACE_TOUR: TourStep[] = [
  {
    target: "steps",
    title: "Fünf Schritte",
    body: "Beschreiben Sie das Asset und bewerten Sie dann Vertraulichkeit, Integrität und Verfügbarkeit. Die Balken zeigen den aktuellen Schutzbedarf je Grundwert.",
  },
  {
    target: "result",
    title: "Ergebnis nach dem Maximumprinzip",
    body: "Der höchste Einzelschaden bestimmt den Schutzbedarf eines Grundwerts. Das Ergebnis aktualisiert sich mit jeder Antwort.",
  },
  {
    target: "close-version",
    title: "Version abschließen",
    body: "Sind alle Begründungen erfasst, schließen Sie die Version ab. Spätere Änderungen entstehen als neue Version und bleiben vergleichbar.",
  },
  {
    target: "file-menu",
    title: "Speichern und exportieren",
    body: "Im Menü „Datei“ speichern Sie diese Analyse als .sba-Datei (⌘S bzw. Strg+S) und exportieren den PDF-Bericht oder eine Tabelle für Excel und LibreOffice.",
  },
];
