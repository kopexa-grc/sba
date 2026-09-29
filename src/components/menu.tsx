import * as Dropdown from "@radix-ui/react-dropdown-menu";
import * as Menubar from "@radix-ui/react-menubar";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./ui";

/*
 * Menus on Radix primitives (keyboard, focus, typeahead, collision handling),
 * styled with the app tokens (see docs/STYLEGUIDE.md, "Menüs").
 */

const CONTENT =
  "z-50 min-w-60 max-w-[calc(100vw-2rem)] rounded-md border border-line bg-paper py-1 text-ink shadow-[0_8px_24px_-8px_rgb(16_38_62/0.22)]";
const ITEM =
  "flex cursor-default items-center gap-3 px-3 py-1.5 text-[13.5px] outline-none select-none data-[disabled]:text-muted/60 data-[highlighted]:bg-surface";
const SEPARATOR = "my-1 h-px bg-line";
const LABEL = "px-3 pt-2 pb-1 text-[12px] text-muted";

/** Right-aligned shortcut hint; the item itself carries aria-keyshortcuts. */
export function Shortcut({ children }: { children: ReactNode }) {
  return (
    <span className="ml-auto pl-6 text-[12px] text-muted tabular" aria-hidden>
      {children}
    </span>
  );
}

// Menu bar (top-level "Datei" menu)

export const MenubarRoot = ({ className, ...p }: ComponentProps<typeof Menubar.Root>) => (
  <Menubar.Root className={cn("flex items-center", className)} {...p} />
);
export const MenubarMenu = Menubar.Menu;

export const MenubarTrigger = ({ className, ...p }: ComponentProps<typeof Menubar.Trigger>) => (
  <Menubar.Trigger
    className={cn(
      "inline-flex h-8 items-center rounded-md px-2 text-[13.5px] text-ink select-none hover:bg-surface data-[state=open]:bg-surface sm:px-2.5",
      className,
    )}
    {...p}
  />
);

export const MenubarContent = ({ className, ...p }: ComponentProps<typeof Menubar.Content>) => (
  <Menubar.Portal>
    <Menubar.Content align="start" sideOffset={4} collisionPadding={16} className={cn(CONTENT, className)} {...p} />
  </Menubar.Portal>
);

export const MenubarItem = ({ className, danger, ...p }: ComponentProps<typeof Menubar.Item> & { danger?: boolean }) => (
  <Menubar.Item className={cn(ITEM, danger && "text-red-700", className)} {...p} />
);
export const MenubarSeparator = () => <Menubar.Separator className={SEPARATOR} />;
export const MenubarLabel = ({ children }: { children: ReactNode }) => <Menubar.Label className={LABEL}>{children}</Menubar.Label>;

// Dropdown (context actions, e.g. "Weitere Aktionen")

export const DropdownRoot = Dropdown.Root;
export const DropdownTrigger = Dropdown.Trigger;

export const DropdownContent = ({ className, ...p }: ComponentProps<typeof Dropdown.Content>) => (
  <Dropdown.Portal>
    <Dropdown.Content align="end" sideOffset={4} collisionPadding={16} className={cn(CONTENT, className)} {...p} />
  </Dropdown.Portal>
);

export const DropdownItem = ({ className, danger, ...p }: ComponentProps<typeof Dropdown.Item> & { danger?: boolean }) => (
  <Dropdown.Item className={cn(ITEM, danger && "text-red-700", className)} {...p} />
);
export const DropdownSeparator = () => <Dropdown.Separator className={SEPARATOR} />;
