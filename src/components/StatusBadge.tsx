import { Lock } from "lucide-react";
import { STATUS_LABEL, type VersionStatus } from "../domain/types";
import { Badge, type Tone } from "./ui";

const TONE: Record<VersionStatus, Tone> = { draft: "info", review: "warning", approved: "success", archived: "neutral" };

export function StatusBadge({ status }: { status: VersionStatus }) {
  return (
    <Badge tone={TONE[status]}>
      {(status === "approved" || status === "archived") && <Lock className="size-3" />}
      {STATUS_LABEL[status]}
    </Badge>
  );
}
