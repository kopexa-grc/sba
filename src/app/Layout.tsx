import { CloudOff, LockKeyhole, Settings, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Button, cn } from "../components/ui";
import { useRouteFocus } from "../lib/a11y";
import { useSession } from "./session";

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="14" fill="#10263e" />
      <rect x="14" y="30" width="9" height="20" rx="2" fill="#10b981" />
      <rect x="27.5" y="22" width="9" height="28" rx="2" fill="#f59e0b" />
      <rect x="41" y="14" width="9" height="36" rx="2" fill="#ef4444" />
    </svg>
  );
}

export function Layout() {
  const { identity, editIdentity } = useSession();
  const online = useOnline();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useRouteFocus();

  const nav = ({ isActive }: { isActive: boolean }) =>
    cn(
      "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] transition-colors sm:px-2.5",
      isActive ? "bg-surface text-ink" : "text-muted hover:text-ink",
    );

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#inhalt"
        className="sr-only z-50 rounded-md bg-primary-950 px-3 py-2 text-[13.5px] text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Zum Inhalt springen
      </a>
      <header className="no-print sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex h-13 max-w-[1280px] items-center gap-2 px-4 sm:gap-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="size-6" />
            <span className="text-[14px] leading-none font-semibold">
              Kopexa <span className="hidden font-normal text-muted sm:inline">Schutzbedarfsanalyse</span>
              <span className="font-normal text-muted sm:hidden">SBA</span>
            </span>
          </Link>
          <nav aria-label="Hauptnavigation" className="ml-auto flex items-center gap-0.5">
            <NavLink to="/" end className={nav}>
              Analysen
            </NavLink>
            <NavLink to="/hilfe" className={nav}>
              Handbuch
            </NavLink>
            <NavLink to="/einstellungen" className={nav} aria-label="Einstellungen" title="Einstellungen" data-tour="settings">
              <Settings className="size-4" aria-hidden />
            </NavLink>
            <button
              type="button"
              onClick={editIdentity}
              className="ml-1 hidden h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-muted hover:text-ink md:inline-flex"
              aria-label={identity ? `Angaben ändern (${identity.name})` : "Name eintragen"}
            >
              <UserRound className="size-4" aria-hidden />
              {identity?.name ?? "Name eintragen"}
            </button>
          </nav>
        </div>
      </header>

      {needRefresh && (
        <div role="status" className="no-print flex items-center justify-center gap-3 border-b border-line px-4 py-2 text-[13px]">
          Eine neue Version der App ist verfügbar.
          <Button size="sm" variant="primary" onClick={() => updateServiceWorker(true)}>
            Jetzt aktualisieren
          </Button>
        </div>
      )}

      <main id="inhalt" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>

      <footer className="no-print border-t border-line bg-paper">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[12px] text-muted sm:px-6">
          <span className="inline-flex items-center gap-1.5">
            <LockKeyhole className="size-3.5" aria-hidden />
            Alle Daten bleiben lokal in diesem Browser – keine Übertragung an Server.
          </span>
          {!online && (
            <span className="inline-flex items-center gap-1.5 text-ink">
              <CloudOff className="size-3.5" aria-hidden /> Offline – voll funktionsfähig
            </span>
          )}
          <nav aria-label="Rechtliches" className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:ml-auto">
            <span>© Kopexa GmbH</span>
            <a className="underline-offset-2 hover:text-ink hover:underline" href="https://kopexa.com/de/legal/imprint">
              Impressum
            </a>
            <a className="underline-offset-2 hover:text-ink hover:underline" href="https://kopexa.com/de/legal/privacy">
              Datenschutz
            </a>
            <a className="underline-offset-2 hover:text-ink hover:underline" href="https://kopexa.com/de/legal/accessibility-statement">
              Barrierefreiheit
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
