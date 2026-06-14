import { describe, expect, it } from "vitest";
import { demoClaims, demoGrant, DEFAULT_AGENT_DID } from "@/lib/domain/seed";
import { evaluateClaimPolicy } from "@/lib/domain/policy";
import type { Claim, Grant } from "@/lib/domain/types";
import {
  buildClaimInput,
  comparePolicyParity,
  decodeClaimDecision,
  tenantDidPreferSession,
  validateContractTail,
  CONTRACT_TAIL
} from "./contract";

const approvedClaim = demoClaims.find((c) => c.amountUsd <= demoGrant.maxAmountUsd) as Claim;
const overLimitClaim = demoClaims.find((c) => c.amountUsd > demoGrant.maxAmountUsd) as Claim;

describe("validateContractTail", () => {
  it("accepts the local contract tail", () => {
    expect(validateContractTail(CONTRACT_TAIL)).toBe("claims-policy");
  });

  it("rejects slashes", () => {
    expect(() => validateContractTail("a/b")).toThrow(/'\/'/);
  });

  it("rejects a canonical z:<tid>: prefixed name", () => {
    expect(() => validateContractTail("z:abcd:claims-policy")).toThrow(/tenant-local/);
  });

  it("rejects empty tail", () => {
    expect(() => validateContractTail("")).toThrow(/required/);
  });
});

describe("tenantDidPreferSession", () => {
  it("prefers the session DID over the env DID", () => {
    expect(tenantDidPreferSession("did:t3n:session", "did:t3n:env")).toBe("did:t3n:session");
  });

  it("falls back to env DID when session is missing", () => {
    expect(tenantDidPreferSession(undefined, "did:t3n:env")).toBe("did:t3n:env");
  });

  it("throws when neither is available", () => {
    expect(() => tenantDidPreferSession("", "")).toThrow(/tenant DID/);
  });
});

describe("buildClaimInput", () => {
  it("produces the sanitized snake_case envelope with no raw PII", () => {
    const input = buildClaimInput(approvedClaim, demoGrant, DEFAULT_AGENT_DID);
    expect(input.agent_did).toBe(DEFAULT_AGENT_DID);
    expect(input.grant_agent_did).toBe(demoGrant.agentDid);
    expect(input.amount_usd).toBe(approvedClaim.amountUsd);
    expect(input.allowed_placeholders).toContain("{{profile.first_name}}");
    // only placeholder markers travel, never resolved values
    const serialized = JSON.stringify(input);
    expect(serialized).toContain("{{profile.");
    expect(serialized).not.toContain(approvedClaim.claimantDisplay);
  });

  it("marks replayed nonce when requested", () => {
    const input = buildClaimInput(approvedClaim, demoGrant, DEFAULT_AGENT_DID, { replayed: true });
    expect(input.replayed_nonce).toBe(true);
  });
});

describe("decodeClaimDecision", () => {
  it("decodes a valid contract response object", () => {
    const decoded = decodeClaimDecision({ decision: "approved", reasons: [] });
    expect(decoded.decision).toBe("approved");
    expect(decoded.reasons).toEqual([]);
  });

  it("decodes a JSON string response", () => {
    const decoded = decodeClaimDecision('{"decision":"denied","reasons":["policy_inactive"]}');
    expect(decoded.decision).toBe("denied");
    expect(decoded.reasons).toEqual(["policy_inactive"]);
  });

  it("throws on an invalid decision value", () => {
    expect(() => decodeClaimDecision({ decision: "maybe", reasons: [] })).toThrow(/invalid decision/);
  });

  it("throws on non-JSON string", () => {
    expect(() => decodeClaimDecision("not json")).toThrow(/not valid JSON/);
  });
});

describe("comparePolicyParity", () => {
  it("matches the local oracle for an approved claim", () => {
    const local = evaluateClaimPolicy(approvedClaim, demoGrant, DEFAULT_AGENT_DID);
    const parity = comparePolicyParity(
      { decision: local.decision, reasons: local.reasons },
      approvedClaim,
      demoGrant,
      DEFAULT_AGENT_DID
    );
    expect(parity.match).toBe(true);
  });

  it("flags a mismatch when the contract disagrees with the local oracle", () => {
    const parity = comparePolicyParity(
      { decision: "approved", reasons: [] },
      overLimitClaim,
      demoGrant,
      DEFAULT_AGENT_DID
    );
    expect(parity.match).toBe(false);
    expect(parity.localDecision).toBe("needs_escalation");
  });
});
