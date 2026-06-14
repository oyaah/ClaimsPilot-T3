import type { AuditEvent, Claim, Grant } from "./types";

export const DEFAULT_AGENT_DID =
  process.env.NEXT_PUBLIC_T3_DID ?? "did:t3n:dc851f7daab01b36a986b212e49673c2bc00f904";

export const demoClaims: Claim[] = [
  {
    id: "CLM-104",
    claimantId: "usr_ivy_chen",
    claimantDisplay: "Ivy C.",
    type: "phone_damage",
    region: "US-CA",
    amountUsd: 420,
    status: "open",
    policyStatus: "active",
    identityVerified: true,
    evidence: ["repair_invoice.pdf", "device_photo.jpg", "policy_match.json"],
    summary: "Cracked phone screen with repair invoice under device protection plan.",
    destinationHost: "mock-insurer.local",
    piiPlaceholders: [
      "{{profile.first_name}}",
      "{{profile.last_name}}",
      "{{profile.verified_contacts.email.value}}"
    ]
  },
  {
    id: "CLM-219",
    claimantId: "usr_mara_singh",
    claimantDisplay: "Mara S.",
    type: "phone_damage",
    region: "US-NY",
    amountUsd: 4800,
    status: "open",
    policyStatus: "active",
    identityVerified: true,
    evidence: ["clinic_invoice.pdf", "diagnosis_code.txt"],
    summary: "Out-of-network urgent care claim above autonomous payout limit.",
    destinationHost: "mock-insurer.local",
    piiPlaceholders: [
      "{{profile.first_name}}",
      "{{profile.last_name}}",
      "{{profile.date_of_birth}}",
      "{{profile.verified_contacts.email.value}}"
    ]
  },
  {
    id: "CLM-331",
    claimantId: "usr_noah_rivera",
    claimantDisplay: "Noah R.",
    type: "travel",
    region: "EU",
    amountUsd: 690,
    status: "open",
    policyStatus: "inactive",
    identityVerified: true,
    evidence: ["delay_notice.pdf", "boarding_pass_redacted.png"],
    summary: "Travel delay claim on an inactive policy.",
    destinationHost: "mock-insurer.local",
    piiPlaceholders: ["{{profile.verified_contacts.email.value}}"]
  },
  {
    id: "CLM-442",
    claimantId: "usr_lina_okafor",
    claimantDisplay: "Lina O.",
    type: "travel",
    region: "US-CA",
    amountUsd: 730,
    status: "open",
    policyStatus: "active",
    identityVerified: false,
    evidence: ["body_shop_quote.pdf"],
    summary: "Travel baggage claim with identity verification still pending.",
    destinationHost: "mock-insurer.local",
    piiPlaceholders: ["{{profile.first_name}}", "{{profile.last_name}}"]
  }
];

export const demoGrant: Grant = {
  id: "grant_claims_phone_750",
  agentDid: DEFAULT_AGENT_DID,
  maxAmountUsd: 750,
  allowedClaimTypes: ["phone_damage", "travel"],
  allowedRegions: ["US-CA", "US-NY", "EU"],
  allowedHosts: ["mock-insurer.local"],
  requiresIdentityVerified: true,
  requiresPolicyActive: true,
  expiresAt: "2026-06-22T15:59:00.000Z",
  revokedAt: null
};

export const initialAuditEvents: AuditEvent[] = [
  {
    id: "evt_seed_status",
    at: new Date("2026-06-14T08:00:00.000Z").toISOString(),
    action: "t3.status",
    decision: "status",
    agentDid: DEFAULT_AGENT_DID,
    mode: "demo",
    reason: "demo",
    message: "Demo store seeded. Live T3N status is checked separately."
  }
];
