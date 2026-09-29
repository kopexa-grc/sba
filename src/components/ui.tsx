import { clsx, type ClassValue } from "clsx";
import {
  forwardRef,
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
  primary: "bg-primary-950 text-white hover:bg-primary-800 disabled:bg-primary-950/40",
  secondary: "bg-paper text-ink border border-line hover:border-primary-300 hover:bg-primary-50 disabled:opacity-50",
  ghost: "text-ink hover:bg-primary-50 disabled:opacity-40",
  danger: "bg-paper text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-50",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
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
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed",
        size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-8.5 px-3 text-[13px]",
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
  "w-full rounded-md border border-line bg-paper px-2.5 text-[13.5px] text-ink placeholder:text-muted/70 transition-colors hover:border-primary-200 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-surface disabled:text-muted read-only:bg-surface";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(FIELD, "h-8.5", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(FIELD, "py-2 leading-relaxed", className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(FIELD, "h-8.5 pr-8", className)} {...rest}>
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
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-[12.5px] font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      {children(id)}
      {error ? (
        <p className="text-[12px] text-red-700">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** Two-or-more option toggle (e.g. Ja / Nein). */
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
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex self-start rounded-md border border-line bg-paper p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-7 min-w-14 rounded-[4px] px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed",
              active ? "bg-primary-950 text-white" : "text-muted hover:bg-primary-50 hover:text-ink",
              disabled && !active && "opacity-60",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-[4px] px-1.5 text-[11.5px] font-medium whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "navy";

const TONE: Record<Tone, string> = {
  neutral: "bg-surface text-muted ring-1 ring-inset ring-line",
  info: "bg-primary-50 text-primary-800 ring-1 ring-inset ring-primary-100",
  success: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
  danger: "bg-red-50 text-red-800 ring-1 ring-inset ring-red-200",
  navy: "bg-primary-950 text-white",
};

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
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-32px)] rounded-lg border border-line bg-paper p-0 text-ink shadow-2xl",
        wide ? "max-w-3xl" : "max-w-lg",
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="border-b border-line px-5 pt-4 pb-3">
            <h2 className="text-[16px] font-semibold">{title}</h2>
            {description && <div className="mt-1 text-[13px] text-muted">{description}</div>}
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-lg border border-line bg-paper", className)}>{children}</section>;
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-line bg-paper px-6 py-12 text-center">
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {children && <div className="mt-1 max-w-md text-[13px] text-muted">{children}</div>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
