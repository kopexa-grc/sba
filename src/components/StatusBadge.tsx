import { Lock } from "lucide-react";
import { STATUS_LABEL, type VersionStatus } from "../domain/types";
import { cn } from "./ui";

/** Status as text; locked states carry a lock glyph. No badge, no color. */
export function StatusText({ status, className }: { status: VersionStatus; className?: string }) {
  const locked = status !== "draft";
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {locked && <Lock className="size-3 shrink-0" aria-hidden />}
      {STATUS_LABEL[status]}
    </span>
  );
}
