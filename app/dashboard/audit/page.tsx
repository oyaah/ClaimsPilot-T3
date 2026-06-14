import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { listAudit } from "@/lib/domain/store";
import { ClipboardList } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AuditPage() {
  const events = listAudit();

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h2>Audit trail</h2>
          <p>
            Every protected-action attempt is recorded with the agent DID, claim, grant, mode, decision, and reason.
          </p>
        </div>
        <span className="badge"><ClipboardList size={14} aria-hidden="true" /> {events.length} rows</span>
      </div>

      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Decision</th>
              <th>Claim</th>
              <th>Amount</th>
              <th>Reason</th>
              <th>Mode</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{new Date(event.at).toLocaleTimeString()}</td>
                <td>{event.action}</td>
                <td><StatusBadge decision={event.decision === "status" ? event.mode : event.decision} label={event.decision} /></td>
                <td>{event.claimId ?? "—"}</td>
                <td>{event.amountUsd ? `$${event.amountUsd}` : "—"}</td>
                <td>{event.message}</td>
                <td>{event.mode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
