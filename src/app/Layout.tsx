import { CloudOff, HelpCircle, LockKeyhole, Settings, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Button, cn } from "../components/ui";
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
      <rect width="64" height="64" rx="14" fill="currentColor" className="text-white/10" />
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

  const nav = ({ isActive }: { isActive: boolean }) =>
    cn(
      "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors",
      isActive ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white",
    );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print sticky top-0 z-30 bg-primary-950 text-white">
        <div className="mx-auto flex h-12 max-w-[1440px] items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="size-7" />
            <span className="font-display text-[15px] leading-none font-semibold tracking-tight">
              Kopexa <span className="hidden font-normal text-white/60 sm:inline">Schutzbedarfsanalyse</span>
              <span className="font-normal text-white/60 sm:hidden">SBA</span>
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-0.5">
            <NavLink to="/" end className={nav}>
              Analysen
            </NavLink>
            <NavLink to="/hilfe" className={nav}>
              <HelpCircle className="size-4" />
              <span className="hidden sm:inline">Handbuch</span>
            </NavLink>
            <NavLink to="/einstellungen" className={nav} aria-label="Einstellungen">
              <Settings className="size-4" />
            </NavLink>
            <button
              type="button"
              onClick={editIdentity}
              className="ml-1 hidden h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-white/70 hover:bg-white/8 hover:text-white md:inline-flex"
              title="Angaben für den Audit-Trail ändern"
            >
              <UserRound className="size-4" />
              {identity?.name}
            </button>
          </nav>
        </div>
      </header>

      {needRefresh && (
        <div className="no-print flex items-center justify-center gap-3 bg-primary-100 px-4 py-2 text-[13px] text-primary-950">
          Eine neue Version der App ist verfügbar.
          <Button size="sm" variant="primary" onClick={() => updateServiceWorker(true)}>
            Jetzt aktualisieren
          </Button>
        </div>
      )}

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="no-print border-t border-line bg-paper">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <LockKeyhole className="size-3.5" />
            Alle Daten bleiben lokal in diesem Browser – keine Übertragung an Server.
          </span>
          {!online && (
            <span className="inline-flex items-center gap-1.5 text-primary-800">
              <CloudOff className="size-3.5" /> Offline – voll funktionsfähig
            </span>
          )}
          <span className="ml-auto">
            © Kopexa GmbH · BSI IT-Grundschutz 200-2 · ISO/IEC 27001
          </span>
        </div>
      </footer>
    </div>
  );
}
