import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { getT3Status } from "@/lib/t3/client";
import { Server, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function T3StatusPage() {
  const status = await getT3Status();

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h2>Terminal 3 status</h2>
          <p>
            Live mode uses the documented T3N SDK handshake and DID authentication flow. Demo/error modes are shown honestly.
          </p>
        </div>
        <StatusBadge decision={status.mode} label={status.mode.toUpperCase()} />
      </div>

      <section className="grid cols-2">
        <div className="panel stack">
          <h3><ShieldCheck size={18} aria-hidden="true" /> Identity</h3>
          <table className="table">
            <tbody>
              <tr><th>DID</th><td><code>{status.did}</code></td></tr>
              <tr><th>Address</th><td>{status.address ? <code>{status.address}</code> : "Not available"}</td></tr>
              <tr><th>Environment</th><td>{status.environment}</td></tr>
              <tr><th>Credits</th><td>{status.availableCredits ?? "Not available"}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="panel stack">
          <h3><Server size={18} aria-hidden="true" /> SDK result</h3>
          <div className="terminal">{status.message}</div>
          <p className="muted">Checked at {new Date(status.checkedAt).toLocaleString()}</p>
        </div>
      </section>
    </AppShell>
  );
}
