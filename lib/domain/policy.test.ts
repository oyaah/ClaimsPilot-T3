import { describe, expect, it } from "vitest";
import { demoClaims, demoGrant, DEFAULT_AGENT_DID } from "./seed";
import { evaluateClaimPolicy } from "./policy";

describe("evaluateClaimPolicy", () => {
  it("approves a valid phone claim under the grant cap", () => {
    const claim = demoClaims.find((item) => item.id === "CLM-104")!;
    const result = evaluateClaimPolicy(claim, demoGrant, DEFAULT_AGENT_DID);
    expect(result.decision).toBe("approved");
    expect(result.reasons).toEqual([]);
  });

  it("requires escalation when the claim exceeds the cap", () => {
    const claim = demoClaims.find((item) => item.id === "CLM-219")!;
    const result = evaluateClaimPolicy(claim, demoGrant, DEFAULT_AGENT_DID);
    expect(result.decision).toBe("needs_escalation");
    expect(result.reasons).toContain("amount_over_limit");
  });

  it("denies inactive policies", () => {
    const claim = demoClaims.find((item) => item.id === "CLM-331")!;
    const result = evaluateClaimPolicy(claim, demoGrant, DEFAULT_AGENT_DID);
    expect(result.decision).toBe("denied");
    expect(result.reasons).toContain("policy_inactive");
  });

  it("denies unverified identities", () => {
    const claim = demoClaims.find((item) => item.id === "CLM-442")!;
    const result = evaluateClaimPolicy(claim, {
      ...demoGrant,
      allowedClaimTypes: ["auto"],
      allowedRegions: ["SG"]
    }, DEFAULT_AGENT_DID);
    expect(result.decision).toBe("denied");
    expect(result.reasons).toContain("identity_not_verified");
  });

  it("denies a grant issued to a different agent", () => {
    const claim = demoClaims.find((item) => item.id === "CLM-104")!;
    const result = evaluateClaimPolicy(claim, demoGrant, "did:t3n:other");
    expect(result.decision).toBe("denied");
    expect(result.reasons).toContain("agent_not_authorized");
  });

  it("rejects replayed idempotency keys", () => {
    const claim = demoClaims.find((item) => item.id === "CLM-104")!;
    const result = evaluateClaimPolicy(claim, demoGrant, DEFAULT_AGENT_DID, new Set(["n1"]), "n1");
    expect(result.decision).toBe("denied");
    expect(result.reasons).toContain("replay_rejected");
  });
});

