import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

const APP_NAME = "Kopexa Schutzbedarfsanalyse";

/** Sets the document title for the current page (announced by screen readers on navigation). */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}

/**
 * Moves keyboard and screen reader focus to the page heading after client-side
 * navigation, so the new page is announced (skips the initial load and hash jumps).
 */
export function useRouteFocus() {
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>("main [data-focus-heading]") ?? document.querySelector<HTMLElement>("main h1");
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);
}
