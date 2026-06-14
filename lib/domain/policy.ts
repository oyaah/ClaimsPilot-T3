import type { Claim, DenialReason, Grant, PolicyDecision } from "./types";

export function evaluateClaimPolicy(
  claim: Claim,
  grant: Grant,
  agentDid: string,
  usedNonces: Set<string> = new Set(),
  nonce = `${claim.id}:${grant.id}`
): PolicyDecision {
  const reasons: DenialReason[] = [];

  if (grant.agentDid !== agentDid) reasons.push("agent_not_authorized");
  if (grant.revokedAt) reasons.push("grant_revoked");
  if (new Date(grant.expiresAt).getTime() < Date.now()) reasons.push("grant_expired");
  if (!grant.allowedClaimTypes.includes(claim.type)) reasons.push("claim_type_not_allowed");
  if (!grant.allowedRegions.includes(claim.region)) reasons.push("claim_type_not_allowed");
  if (claim.amountUsd > grant.maxAmountUsd) reasons.push("amount_over_limit");
  if (grant.requiresPolicyActive && claim.policyStatus !== "active") reasons.push("policy_inactive");
  if (grant.requiresIdentityVerified && !claim.identityVerified) reasons.push("identity_not_verified");
  if (!grant.allowedHosts.includes(claim.destinationHost)) reasons.push("host_not_allowed");
  if (usedNonces.has(nonce)) reasons.push("replay_rejected");
  if (claim.piiPlaceholders.some((field) => !isPermittedPlaceholder(field))) {
    reasons.push("placeholder_not_permitted");
  }

  return {
    decision: reasons.length === 0 ? "approved" : claim.amountUsd > grant.maxAmountUsd ? "needs_escalation" : "denied",
    reasons,
    claim,
    grant,
    sanitizedPayload: {
      claimId: claim.id,
      claimType: claim.type,
      amountUsd: claim.amountUsd,
      claimantRef: claim.claimantId,
      placeholders: claim.piiPlaceholders,
      destinationHost: claim.destinationHost
    }
  };
}

export function primaryReason(decision: PolicyDecision): DenialReason | undefined {
  return decision.reasons[0];
}

export const PERMITTED_PLACEHOLDERS = [
  "{{profile.first_name}}",
  "{{profile.last_name}}",
  "{{profile.date_of_birth}}",
  "{{profile.verified_contacts.email.value}}"
] as const;

export function isPermittedPlaceholder(field: string): boolean {
  return (PERMITTED_PLACEHOLDERS as readonly string[]).includes(field);
}

export function describeReason(reason: DenialReason | undefined): string {
  switch (reason) {
    case "agent_not_authorized":
      return "The active grant belongs to a different agent DID.";
    case "claim_type_not_allowed":
      return "The claim type or region is outside the delegated scope.";
    case "amount_over_limit":
      return "The payout amount exceeds the delegated cap.";
    case "policy_inactive":
      return "The policy is inactive.";
    case "identity_not_verified":
      return "Claimant identity has not been verified.";
    case "host_not_allowed":
      return "The destination host is missing from the user's allowed-host grant.";
    case "replay_rejected":
      return "This idempotency key has already been used.";
    case "placeholder_not_permitted":
      return "The contract requested a profile placeholder outside the allowed list.";
    case "grant_expired":
      return "The delegation grant has expired.";
    case "grant_revoked":
      return "The delegation grant has been revoked.";
    default:
      return "All delegated policy checks passed.";
  }
}

