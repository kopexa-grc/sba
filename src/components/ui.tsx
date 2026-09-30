import { clsx, type ClassValue } from "clsx";
import { AlertTriangle, CircleAlert, Info } from "lucide-react";
import {
  cloneElement,
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON: Record<ButtonVariant, string> = {
  primary: "bg-primary-950 text-white hover:bg-primary-800 active:bg-primary-900 disabled:bg-primary-950/35",
  secondary: "border border-line bg-paper text-ink hover:bg-surface disabled:text-muted",
  ghost: "text-ink hover:bg-surface disabled:text-muted",
  danger: "border border-line bg-paper text-red-700 hover:bg-surface disabled:text-muted",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  /** Only for icons that carry meaning (see styleguide). */
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors duration-100 disabled:cursor-not-allowed",
        size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-8 px-3 text-[13.5px]",
        BUTTON[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

const FIELD =
  "w-full rounded-md border border-line bg-paper px-2.5 text-[13.5px] text-ink placeholder:text-muted/80 transition-colors duration-100 hover:border-ink/25 focus:border-primary-950 focus:outline-none aria-invalid:border-red-700 disabled:bg-surface disabled:text-muted";
const READ_ONLY = "read-only:border-transparent read-only:bg-surface read-only:hover:border-transparent";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(FIELD, READ_ONLY, "h-8", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(FIELD, READ_ONLY, "py-1.5 leading-relaxed", className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(FIELD, "h-8 pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const describedBy = error || hint ? `${id}-desc` : undefined;
  // Wire hint/error and state to the control, so screen readers announce them.
  const control = children(id);
  const wired = isValidElement<Record<string, unknown>>(control)
    ? cloneElement(control, {
        "aria-describedby": describedBy,
        "aria-required": required || undefined,
        "aria-invalid": error ? true : undefined,
      })
    : control;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
        {required && <span className="ml-1.5 font-normal text-muted">(Pflicht)</span>}
      </label>
      {wired}
      {error ? (
        <p id={describedBy} className="text-[12.5px] text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={describedBy} className="text-[12.5px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Two-or-three option toggle (e.g. Ja / Nein), following the WAI-ARIA radio
 * group pattern: one tab stop, arrow keys move and select.
 */
export function Segmented<T extends string | number | boolean>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  label: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = options.findIndex((o) => o.value === value);
  const focusable = selected >= 0 ? selected : 0;

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    let next: number | null = null;
    if (e.key in keys) next = (index + keys[e.key]! + options.length) % options.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = options.length - 1;
    if (next === null) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(options[next]!.value);
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className="inline-flex self-start overflow-hidden rounded-md border border-line"
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={i === focusable ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "h-8 min-w-16 px-3.5 text-[13.5px] transition-colors duration-100 focus-visible:relative focus-visible:z-10 disabled:cursor-not-allowed",
              i > 0 && "border-l border-line",
              active ? "bg-primary-950 font-medium text-white" : "bg-paper text-ink hover:bg-surface",
              disabled && !active && "text-muted hover:bg-paper",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Inline notice: signal-colored icon, text in ink, no background. */
export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "warning" | "error";
  children: ReactNode;
  className?: string;
}) {
  const Icon = tone === "error" ? CircleAlert : tone === "warning" ? AlertTriangle : Info;
  return (
    <div className={cn("flex gap-2 text-[13px] leading-snug text-ink", className)}>
      <Icon
        aria-hidden
        className={cn(
          "mt-[2px] size-3.5 shrink-0",
          tone === "error" ? "text-red-700" : tone === "warning" ? "text-amber-600" : "text-muted",
        )}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-32px)] rounded-lg border border-line bg-paper p-0 text-ink shadow-[0_16px_48px_-12px_rgb(16_38_62/0.28)]",
        wide ? "max-w-3xl" : "max-w-lg",
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="px-5 pt-5 pb-1">
            <h2 id={titleId} className="text-[16px] font-semibold">
              {title}
            </h2>
            {description && (
              <div id={descId} className="mt-1 text-[13px] leading-relaxed text-muted">
                {description}
              </div>
            )}
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 px-5 pt-1 pb-5">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/** Section: heading + optional one-line description, no frame. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24", className)}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="max-w-xl py-6">
      <h2 className="text-[17px] font-semibold">{title}</h2>
      {children && <div className="mt-1 text-[14px] text-muted">{children}</div>}
      {action && <div className="mt-4 flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

/** Dot-separated meta line ("Anwendung · Owner: … · zuletzt …"). */
export function Meta({ items, className }: { items: ReactNode[]; className?: string }) {
  const shown = items.filter(Boolean);
  return (
    <div className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] text-muted", className)}>
      {shown.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>·</span>}
          {it}
        </span>
      ))}
    </div>
  );
}
