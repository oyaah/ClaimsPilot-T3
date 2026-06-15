import type { Claim, Decision, DenialReason, Grant } from "@/lib/domain/types";
import {
  CONTRACT_FUNCTION,
  CONTRACT_SUBMIT_FUNCTION,
  buildClaimInput,
  buildSubmitClaimInput,
  comparePolicyParity,
  createAuthenticatedT3Contract,
  decodeClaimDecision,
  decodeSubmitClaimResult
} from "./contract";
import { hasContractRegistration, readContractRegistration } from "./contract-state";

export type DecisionSource = "live" | "demo";

/**
 * Select the claim-decision source. Live T3N contract is used only when the
 * app is not in demo mode, an API key is configured, AND a registration exists.
 * Otherwise the deterministic local policy runs (recording demo flows).
 */
export function getDecisionSource(): DecisionSource {
  const demoMode = process.env.CLAIMSPILOT_DEMO_MODE === "true";
  const hasKey = Boolean(process.env.T3N_API_KEY?.trim());
  if (!demoMode && hasKey && hasContractRegistration()) return "live";
  return "demo";
}

export type LiveContractDecision = {
  decision: Decision;
  reasons: DenialReason[];
  scriptName: string;
  scriptVersion: string;
  parityMatch: boolean;
  localDecision: Decision;
};

export type LiveContractSubmit = {
  status: string;
  claimId: string;
  insurerReference?: string;
  scriptName: string;
  scriptVersion: string;
  sanitized: boolean;
  piiEchoed: boolean;
};

/**
 * Server-only: evaluate one claim by invoking the registered T3N contract.
 * The decision comes from the TEE contract, not local TypeScript. Live network.
 */
export async function evaluateClaimViaContract(
  claim: Claim,
  grant: Grant,
  agentDid: string,
  opts: { replayed?: boolean } = {}
): Promise<LiveContractDecision> {
  const registration = readContractRegistration();
  if (!registration) {
    throw new Error("No contract registration found; run `npm run t3:register` first.");
  }

  const ctx = await createAuthenticatedT3Contract();

  let scriptVersion = registration.version;
  try {
    scriptVersion = await ctx.sdk.getScriptVersion(ctx.sdk.getNodeUrl(), registration.scriptName);
  } catch {
    // fall back to the registered version on resolution failure
  }

  const input = buildClaimInput(claim, grant, agentDid, opts);
  const raw = await ctx.t3n.executeAndDecode({
    script_name: registration.scriptName,
    script_version: scriptVersion,
    function_name: CONTRACT_FUNCTION,
    input
  });

  const decoded = decodeClaimDecision(raw);
  const parity = comparePolicyParity(decoded, claim, grant, agentDid);

  return {
    decision: decoded.decision,
    reasons: decoded.reasons,
    scriptName: registration.scriptName,
    scriptVersion,
    parityMatch: parity.match,
    localDecision: parity.localDecision
  };
}

/**
 * Server-only: submit one already-approved claim through the registered T3N
 * contract's placeholder outbound path. Live network.
 */
export async function submitClaimViaContract(
  claim: Claim,
  grant: Grant,
  opts: { idempotencyKey: string; insurerBaseUrl?: string }
): Promise<LiveContractSubmit> {
  const registration = readContractRegistration();
  if (!registration) {
    throw new Error("No contract registration found; run `npm run t3:register` first.");
  }

  const ctx = await createAuthenticatedT3Contract();

  let scriptVersion = registration.version;
  try {
    scriptVersion = await ctx.sdk.getScriptVersion(ctx.sdk.getNodeUrl(), registration.scriptName);
  } catch {
    // fall back to the registered version on resolution failure
  }

  const input = buildSubmitClaimInput(claim, grant, opts);
  const raw = await ctx.t3n.executeAndDecode({
    script_name: registration.scriptName,
    script_version: scriptVersion,
    function_name: CONTRACT_SUBMIT_FUNCTION,
    input
  });

  const decoded = decodeSubmitClaimResult(raw);

  return {
    status: decoded.status,
    claimId: decoded.claim_id,
    insurerReference: decoded.insurer_reference,
    scriptName: registration.scriptName,
    scriptVersion,
    sanitized: decoded.sanitized,
    piiEchoed: decoded.pii_echoed
  };
}
