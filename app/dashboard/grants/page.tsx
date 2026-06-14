import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { describeReason, evaluateClaimPolicy, primaryReason } from "@/lib/domain/policy";
import { DEFAULT_AGENT_DID } from "@/lib/domain/seed";
import { getActiveGrant, listClaims } from "@/lib/domain/store";
import { KeyRound, RotateCcw, ShieldOff, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default function GrantsPage() {
  const grant = getActiveGrant();
  const claims = listClaims();
  const escalationClaim = claims.find((claim) => evaluateClaimPolicy(claim, grant, DEFAULT_AGENT_DID).decision === "needs_escalation");

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h2>Delegation grants</h2>
          <p>
            ClaimsPilot keeps the grant visible: payout cap, claim scope, allowed host, expiry, and revocation state.
          </p>
        </div>
        <StatusBadge decision={grant.revokedAt ? "revoked" : "approved"} label={grant.revokedAt ? "Revoked" : "Active"} />
      </div>

      <section className="grid cols-2">
        <div className="panel stack">
          <h3><KeyRound size={18} aria-hidden="true" /> Active grant</h3>
          <table className="table">
            <tbody>
              <tr><th>Grant</th><td>{grant.id}</td></tr>
              <tr><th>Agent DID</th><td><code>{grant.agentDid}</code></td></tr>
              <tr><th>Max payout</th><td>${grant.maxAmountUsd}</td></tr>
              <tr><th>Claim types</th><td>{grant.allowedClaimTypes.join(", ")}</td></tr>
              <tr><th>Regions</th><td>{grant.allowedRegions.join(", ")}</td></tr>
              <tr><th>Allowed hosts</th><td>{grant.allowedHosts.join(", ")}</td></tr>
              <tr><th>Expires</th><td>{new Date(grant.expiresAt).toLocaleString()}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="panel stack">
          <h3>Grant controls</h3>
          {escalationClaim ? (
            <form action="/api/grants/escalate" method="post">
              <input type="hidden" name="claimId" value={escalationClaim.id} />
              <button className="button" type="submit">
                <TrendingUp size={16} aria-hidden="true" />
                Escalate for {escalationClaim.id}
              </button>
            </form>
          ) : (
            <p className="muted">Run an over-limit claim to create an escalation path.</p>
          )}
          <form action="/api/grants/revoke" method="post">
            <button className="button danger" type="submit">
              <ShieldOff size={16} aria-hidden="true" />
              Revoke agent
            </button>
          </form>
          <form action="/api/grants/reset" method="post">
            <button className="button secondary" type="submit">
              <RotateCcw size={16} aria-hidden="true" />
              Reset demo
            </button>
          </form>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h3>Current claim outcomes under this grant</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Claim</th>
              <th>Amount</th>
              <th>Decision</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => {
              const decision = evaluateClaimPolicy(claim, grant, DEFAULT_AGENT_DID);
              const reason = primaryReason(decision);
              return (
                <tr key={claim.id}>
                  <td>{claim.id} · {claim.type}</td>
                  <td>${claim.amountUsd}</td>
                  <td><StatusBadge decision={decision.decision} /></td>
                  <td>{describeReason(reason)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
