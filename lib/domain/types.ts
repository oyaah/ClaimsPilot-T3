export type ClaimType = "phone_damage" | "medical" | "travel" | "auto";
export type ClaimStatus = "open" | "approved" | "denied" | "needs_escalation";
export type PolicyStatus = "active" | "inactive";
export type Region = "US-CA" | "US-NY" | "SG" | "EU";

export type Claim = {
  id: string;
  claimantId: string;
  claimantDisplay: string;
  type: ClaimType;
  region: Region;
  amountUsd: number;
  status: ClaimStatus;
  policyStatus: PolicyStatus;
  identityVerified: boolean;
  evidence: string[];
  summary: string;
  destinationHost: string;
  piiPlaceholders: string[];
};

export type Grant = {
  id: string;
  agentDid: string;
  maxAmountUsd: number;
  allowedClaimTypes: ClaimType[];
  allowedRegions: Region[];
  allowedHosts: string[];
  requiresIdentityVerified: boolean;
  requiresPolicyActive: boolean;
  expiresAt: string;
  revokedAt: string | null;
};

export type Decision =
  | "approved"
  | "denied"
  | "needs_escalation";

export type DenialReason =
  | "agent_not_authorized"
  | "claim_type_not_allowed"
  | "amount_over_limit"
  | "policy_inactive"
  | "identity_not_verified"
  | "host_not_allowed"
  | "replay_rejected"
  | "placeholder_not_permitted"
  | "grant_expired"
  | "grant_revoked";

export type PolicyDecision = {
  decision: Decision;
  reasons: DenialReason[];
  claim: Claim;
  grant: Grant;
  sanitizedPayload: {
    claimId: string;
    claimType: ClaimType;
    amountUsd: number;
    claimantRef: string;
    placeholders: string[];
    destinationHost: string;
  };
};

export type AuditEvent = {
  id: string;
  at: string;
  action:
    | "claim.evaluate"
    | "claim.approve"
    | "claim.deny"
    | "grant.escalate"
    | "grant.revoke"
    | "t3.status";
  decision: Decision | "revoked" | "status";
  agentDid: string;
  claimId?: string;
  grantId?: string;
  amountUsd?: number;
  host?: string;
  reason?: DenialReason | "live" | "demo" | "error";
  mode: "live" | "demo" | "error";
  message: string;
};

