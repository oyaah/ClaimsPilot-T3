import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describeReason, evaluateClaimPolicy, primaryReason } from "./policy";
import { DEFAULT_AGENT_DID, demoClaims, demoGrant, initialAuditEvents } from "./seed";
import type { AuditEvent, Claim, Grant, PolicyDecision } from "./types";

type StoreState = {
  claims: Claim[];
  grant: Grant;
  audit: AuditEvent[];
  usedNonces: string[];
};

let memoryState: StoreState | null = null;

function seedState(): StoreState {
  return {
    claims: demoClaims.map((claim) => ({
      ...claim,
      evidence: [...claim.evidence],
      piiPlaceholders: [...claim.piiPlaceholders]
    })),
    grant: { ...demoGrant },
    audit: initialAuditEvents.map((event) => ({ ...event })),
    usedNonces: []
  };
}

function statePath() {
  const directory = join(process.cwd(), ".claimspilot-state");
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
  return join(directory, process.env.VITEST ? "test.json" : "demo.json");
}

function readState(): StoreState {
  if (process.env.VITEST) {
    memoryState ??= seedState();
    return memoryState;
  }

  const file = statePath();
  if (!existsSync(file)) {
    const seeded = seedState();
    writeState(seeded);
    return seeded;
  }

  return JSON.parse(readFileSync(file, "utf8")) as StoreState;
}

function writeState(nextState: StoreState): void {
  if (process.env.VITEST) {
    memoryState = nextState;
    return;
  }

  writeFileSync(statePath(), `${JSON.stringify(nextState, null, 2)}\n`);
}

export function listClaims(): Claim[] {
  return readState().claims;
}

export function getClaim(id: string): Claim | undefined {
  return readState().claims.find((claim) => claim.id === id);
}

export function getActiveGrant(): Grant {
  return readState().grant;
}

export function updateGrant(update: Partial<Grant>): Grant {
  const state = readState();
  state.grant = { ...state.grant, ...update };
  writeState(state);
  return state.grant;
}

export function revokeGrant(): Grant {
  const state = readState();
  state.grant = { ...state.grant, revokedAt: new Date().toISOString() };
  appendAudit(state, {
    action: "grant.revoke",
    decision: "revoked",
    agentDid: state.grant.agentDid,
    grantId: state.grant.id,
    mode: "demo",
    reason: "grant_revoked",
    message: "Delegation revoked. Existing agent sessions must request a fresh grant."
  });
  writeState(state);
  return state.grant;
}

export function evaluateClaim(claimId: string, agentDid = DEFAULT_AGENT_DID): PolicyDecision {
  const state = readState();
  const claim = state.claims.find((row) => row.id === claimId);
  if (!claim) throw new Error(`Claim not found: ${claimId}`);

  const nonce = `${claim.id}:${state.grant.id}:${claim.amountUsd}`;
  const decision = evaluateClaimPolicy(claim, state.grant, agentDid, new Set(state.usedNonces), nonce);
  const reason = primaryReason(decision);

  appendAudit(state, {
    action: decision.decision === "approved" ? "claim.approve" : "claim.deny",
    decision: decision.decision,
    agentDid,
    claimId: claim.id,
    grantId: state.grant.id,
    amountUsd: claim.amountUsd,
    host: claim.destinationHost,
    mode: "demo",
    reason,
    message: describeReason(reason)
  });

  if (decision.decision === "approved") {
    state.usedNonces.push(nonce);
    claim.status = "approved";
  } else if (decision.decision === "needs_escalation") {
    claim.status = "needs_escalation";
  } else {
    claim.status = "denied";
  }

  writeState(state);
  return decision;
}

export function escalateGrant(maxAmountUsd: number, claimType: Grant["allowedClaimTypes"][number]): Grant {
  const state = readState();
  state.grant = {
    ...state.grant,
    maxAmountUsd,
    allowedClaimTypes: Array.from(new Set([...state.grant.allowedClaimTypes, claimType])),
    revokedAt: null
  };
  appendAudit(state, {
    action: "grant.escalate",
    decision: "approved",
    agentDid: state.grant.agentDid,
    grantId: state.grant.id,
    amountUsd: maxAmountUsd,
    mode: "demo",
    message: `Grant escalated to $${maxAmountUsd} for ${claimType}.`
  });
  writeState(state);
  return state.grant;
}

export function listAudit(): AuditEvent[] {
  return [...readState().audit].sort((a, b) => b.at.localeCompare(a.at));
}

export function resetDemoState(): void {
  writeState(seedState());
}

function appendAudit(state: StoreState, event: Omit<AuditEvent, "id" | "at">): AuditEvent {
  const row: AuditEvent = {
    id: `evt_${state.audit.length + 1}_${Date.now()}`,
    at: new Date().toISOString(),
    ...event
  };
  state.audit.push(row);
  return row;
}
