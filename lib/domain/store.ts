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

/**
 * Source-aware evaluation. When the live T3N contract is selected (not demo
 * mode, key configured, registration present), the decision comes from the TEE
 * contract; on contract failure it falls back to the local policy and marks the
 * fallback in the audit row. Otherwise it runs the local demo path. The audit
 * row records the decision source and (for live) the script name/version proof.
 */
export async function evaluateClaimWithSource(
  claimId: string,
  agentDid = DEFAULT_AGENT_DID
): Promise<
  PolicyDecision & {
    source: "live" | "demo" | "error";
    outbound?: { status: string; insurerReference?: string };
  }
> {
  const { getDecisionSource, evaluateClaimViaContract, submitClaimViaContract } = await import(
    "@/lib/t3/decision-source"
  );
  if (getDecisionSource() !== "live") {
    return { ...evaluateClaim(claimId, agentDid), source: "demo" };
  }

  const state = readState();
  const claim = state.claims.find((row) => row.id === claimId);
  if (!claim) throw new Error(`Claim not found: ${claimId}`);

  const nonce = `${claim.id}:${state.grant.id}:${claim.amountUsd}`;
  const replayed = state.usedNonces.includes(nonce);
  // Local oracle decision is the structural fallback; the contract is authoritative when live.
  const localDecision = evaluateClaimPolicy(claim, state.grant, agentDid, new Set(state.usedNonces), nonce);

  let decision = localDecision;
  let source: "live" | "error" = "live";
  let message: string;
  let mode: AuditEvent["mode"] = "live";
  let outbound: { status: string; insurerReference?: string } | undefined;

  try {
    const live = await evaluateClaimViaContract(claim, state.grant, agentDid, { replayed });
    decision = { ...localDecision, decision: live.decision, reasons: live.reasons };
    const parityNote = live.parityMatch ? "parity ok" : `PARITY MISMATCH local=${live.localDecision}`;
    message = `Live T3N contract ${live.scriptName}@${live.scriptVersion}: ${describeReason(primaryReason(decision))} (${parityNote})`;
  } catch (error) {
    source = "error";
    mode = "error";
    const reason = error instanceof Error ? error.message : String(error);
    message = `Live contract unavailable; fell back to local policy. ${reason}`;
  }

  appendAudit(state, {
    action: decision.decision === "approved" ? "claim.approve" : "claim.deny",
    decision: decision.decision,
    agentDid,
    claimId: claim.id,
    grantId: state.grant.id,
    amountUsd: claim.amountUsd,
    host: claim.destinationHost,
    mode,
    reason: mode === "error" ? "error" : primaryReason(decision),
    message
  });

  if (source === "live" && decision.decision === "approved") {
    try {
      const submitted = await submitClaimViaContract(claim, state.grant, { idempotencyKey: nonce });
      outbound = { status: submitted.status, insurerReference: submitted.insurerReference };
      appendAudit(state, {
        action: "claim.submit",
        decision: "approved",
        agentDid,
        claimId: claim.id,
        grantId: state.grant.id,
        amountUsd: claim.amountUsd,
        host: claim.destinationHost,
        mode: "live",
        reason: "live",
        message: `Placeholder outbound ${submitted.scriptName}@${submitted.scriptVersion}: ${submitted.status}${submitted.insurerReference ? ` (${submitted.insurerReference})` : ""}.`
      });
    } catch (error) {
      const failure = classifyOutboundFailure(error);
      outbound = { status: failure.status };
      appendAudit(state, {
        action: "claim.submit",
        decision: "denied",
        agentDid,
        claimId: claim.id,
        grantId: state.grant.id,
        amountUsd: claim.amountUsd,
        host: claim.destinationHost,
        mode: failure.mode,
        reason: failure.reason,
        message: failure.message
      });
    }
  }

  if (decision.decision === "approved") {
    state.usedNonces.push(nonce);
    claim.status = "approved";
  } else if (decision.decision === "needs_escalation") {
    claim.status = "needs_escalation";
  } else {
    claim.status = "denied";
  }

  writeState(state);
  return { ...decision, source, outbound };
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

function classifyOutboundFailure(error: unknown): {
  status: string;
  reason: AuditEvent["reason"];
  mode: AuditEvent["mode"];
  message: string;
} {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (normalized.includes("egress denied") || normalized.includes("host_not_allowed")) {
    return {
      status: "egress_denied",
      reason: "host_not_allowed",
      mode: "live",
      message: `T3N placeholder outbound denied by allowed-host grant: ${message}`
    };
  }
  if (normalized.includes("placeholder")) {
    return {
      status: "placeholder_denied",
      reason: "placeholder_not_permitted",
      mode: "live",
      message: `T3N placeholder outbound denied by profile-placeholder policy: ${message}`
    };
  }
  return {
    status: "submit_error",
    reason: "error",
    mode: "error",
    message: `T3N placeholder outbound failed: ${message}`
  };
}
