import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";
import type { Decision } from "@/lib/domain/types";

export function StatusBadge({ decision, label }: { decision: Decision | "live" | "demo" | "error" | "revoked" | "status"; label?: string }) {
  const variant =
    decision === "approved" || decision === "live"
      ? "allow"
      : decision === "denied" || decision === "error" || decision === "revoked"
        ? "deny"
        : "warn";
  const Icon = variant === "allow" ? CheckCircle2 : variant === "deny" ? CircleAlert : CircleDashed;
  return (
    <span className={`badge ${variant}`}>
      <Icon size={14} aria-hidden="true" />
      {label ?? decision}
    </span>
  );
}

