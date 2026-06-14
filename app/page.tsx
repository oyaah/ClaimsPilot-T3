import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { describeReason, evaluateClaimPolicy, primaryReason } from "@/lib/domain/policy";
import { DEFAULT_AGENT_DID } from "@/lib/domain/seed";
import { getActiveGrant, listAudit, listClaims } from "@/lib/domain/store";
import { Bot, LockKeyhole, Send, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const claims = listClaims();
  const grant = getActiveGrant();
  const audit = listAudit();
  const approved = claims.filter((claim) => claim.status === "approved").length;

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h2>Protected claims command center</h2>
          <p>
            The agent can recommend claim actions, but final approvals route through a Terminal 3-style
            protected action layer with grant checks, placeholder-only PII handling, and audit rows.
          </p>
        </div>
        <StatusBadge decision={grant.revokedAt ? "revoked" : "approved"} label={grant.revokedAt ? "Grant revoked" : "Grant active"} />
      </div>

      <section className="grid cols-3" aria-label="ClaimsPilot metrics">
        <div className="panel">
          <h3>Open claims</h3>
          <div className="metric">{claims.filter((claim) => claim.status === "open").length}</div>
          <p className="muted">Seeded demo queue</p>
        </div>
        <div className="panel">
          <h3>Approved</h3>
          <div className="metric">{approved}</div>
          <p className="muted">Only after policy evaluation</p>
        </div>
        <div className="panel">
          <h3>Audit rows</h3>
          <div className="metric">{audit.length}</div>
          <p className="muted">Allow, deny, escalate, revoke</p>
        </div>
      </section>

      <section className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="panel stack">
          <h3><Bot size={18} aria-hidden="true" /> Claims agent</h3>
          <p className="muted">
            Agent DID: <code>{DEFAULT_AGENT_DID}</code>
          </p>
          <div className="terminal">
            {`System: Never expose claimant PII.\nTool: evaluate_claim_policy(claimId)\nBoundary: final action requires T3 grant + TEE policy.\nPII: placeholders only, e.g. {{profile.first_name}}`}
          </div>
        </div>
        <div className="panel stack">
          <h3><ShieldCheck size={18} aria-hidden="true" /> Active grant</h3>
          <p><strong>${grant.maxAmountUsd}</strong> autonomous payout cap</p>
          <p className="muted">
            Claim types: {grant.allowedClaimTypes.join(", ")} · Regions: {grant.allowedRegions.join(", ")}
          </p>
          <p className="muted">Allowed hosts: {grant.allowedHosts.join(", ")}</p>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h3>Claims queue</h3>
        <div className="stack">
          {claims.map((claim) => {
            const decision = evaluateClaimPolicy(claim, grant, DEFAULT_AGENT_DID);
            const reason = primaryReason(decision);
            const isProcessed = claim.status !== "open";
            const displayDecision = claim.status === "open"
              ? decision.decision
              : claim.status === "approved"
                ? "approved"
                : claim.status === "needs_escalation"
                  ? "needs_escalation"
                  : "denied";
            const processedReason = claim.status === "approved"
              ? "Protected payout completed."
              : claim.status === "needs_escalation"
                ? "Needs human escalation."
                : "Protected action blocked.";
            const displayReason = isProcessed ? processedReason : describeReason(reason);
            const actionLabel = claim.status === "approved"
              ? "Approved"
              : claim.status === "needs_escalation"
                ? "Escalated"
                : claim.status === "denied"
                  ? "Blocked"
                  : "Run action";
            return (
              <div className="claim-row" key={claim.id}>
                <div>
                  <strong>{claim.id} · {claim.summary}</strong>
                  <span className="muted">{claim.claimantDisplay} · {claim.region} · ${claim.amountUsd}</span>
                  <div className="claim-meta">
                    <StatusBadge decision={displayDecision} />
                    <span className="badge"><LockKeyhole size={14} aria-hidden="true" /> {claim.piiPlaceholders.length} placeholders</span>
                    <span className="badge">{displayReason}</span>
                  </div>
                </div>
                <form action="/api/claims/evaluate" method="post">
                  <input type="hidden" name="claimId" value={claim.id} />
                  <button className="button" type="submit" disabled={isProcessed}>
                    <Send size={16} aria-hidden="true" />
                    {actionLabel}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
