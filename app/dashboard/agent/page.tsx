import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { planAgentActionLive, shouldUseLiveAgent } from "@/lib/agent/planner";
import { getActiveGrant, listClaims } from "@/lib/domain/store";
import { Bot, LockKeyhole } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const grant = getActiveGrant();
  const claims = listClaims();
  const plans = await Promise.all(claims.map((claim) => planAgentActionLive(claim, grant)));
  const liveAgent = shouldUseLiveAgent();

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h2>Claims agent</h2>
          <p>
            The agent can recommend actions, but the protected action layer makes the final decision.
          </p>
        </div>
        <span className="badge"><Bot size={14} aria-hidden="true" /> {liveAgent ? "live OpenAI planner" : "deterministic planner"}</span>
      </div>

      <section className="grid">
        {claims.map((claim, index) => {
          const plan = plans[index];
          const isProcessed = claim.status !== "open";
          const displayDecision = claim.status === "open"
            ? plan.recommendedDecision
            : claim.status === "approved"
              ? "approved"
              : claim.status === "needs_escalation"
                ? "needs_escalation"
                : "denied";
          return (
            <div className="panel claim-row" key={claim.id}>
              <div>
                <strong>{claim.id}: {plan.title}</strong>
                <p className="muted">{plan.message}</p>
                <div className="claim-meta">
                  <StatusBadge decision={displayDecision} />
                  <span className="badge"><LockKeyhole size={14} aria-hidden="true" /> {plan.privateDataHandling}</span>
                  <span className="badge">{plan.source === "openai" ? `OpenAI ${plan.model}` : plan.source.replace("_", " ")}</span>
                </div>
                {plan.error ? <p className="muted">Planner fallback: {plan.error}</p> : null}
              </div>
              <form action="/api/claims/evaluate" method="post">
                <input type="hidden" name="claimId" value={claim.id} />
                <button className="button" type="submit" disabled={isProcessed}>
                  {isProcessed ? "Processed" : "Execute via policy"}
                </button>
              </form>
            </div>
          );
        })}
      </section>
    </AppShell>
  );
}
