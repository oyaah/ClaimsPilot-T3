import { describe, expect, it } from "vitest";
import { demoClaims, demoGrant, DEFAULT_AGENT_DID } from "@/lib/domain/seed";
import { evaluateClaimPolicy } from "@/lib/domain/policy";
import type { Claim, Grant } from "@/lib/domain/types";
import {
  buildClaimInput,
  buildInsurerSubmitUrl,
  buildSubmitClaimInput,
  comparePolicyParity,
  decodeClaimDecision,
  decodeSubmitClaimResult,
  isVersionConflictError,
  tenantDidPreferSession,
  validateContractTail,
  versionConflictHelp,
  CONTRACT_TAIL,
  CONTRACT_VERSION
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

describe("buildSubmitClaimInput", () => {
  it("uses contract version 0.2.0 for the placeholder outbound milestone", () => {
    expect(CONTRACT_VERSION).toBe("0.2.0");
  });

  it("builds the placeholder-only outbound envelope with no raw PII", () => {
    const input = buildSubmitClaimInput(approvedClaim, demoGrant, {
      idempotencyKey: "CLM-104:grant_demo:420",
      insurerBaseUrl: "https://claims.example.com"
    });

    expect(input.destination_url).toBe("https://claims.example.com/api/mock-insurer/payouts");
    expect(input.placeholders).toContain("{{profile.first_name}}");

    const serialized = JSON.stringify(input);
    expect(serialized).toContain("{{profile.");
    expect(serialized).not.toContain(approvedClaim.claimantDisplay);
  });

  it("derives the submit URL from the claim host when no base URL is configured", () => {
    expect(buildInsurerSubmitUrl(approvedClaim)).toBe("https://mock-insurer.local/api/mock-insurer/payouts");
  });

  it("rejects a submit when the grant lacks the destination host", () => {
    const grant: Grant = { ...demoGrant, allowedHosts: [] };
    expect(() =>
      buildSubmitClaimInput(approvedClaim, grant, { idempotencyKey: "CLM-104:grant_demo:420" })
    ).toThrow(/host_not_allowed/);
  });

  it("rejects unpermitted placeholder markers before invoking T3N", () => {
    const claim: Claim = { ...approvedClaim, piiPlaceholders: ["{{profile.ssn}}"] };
    expect(() =>
      buildSubmitClaimInput(claim, demoGrant, { idempotencyKey: "CLM-104:grant_demo:420" })
    ).toThrow(/placeholder_not_permitted/);
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

describe("decodeSubmitClaimResult", () => {
  it("decodes a valid submit result", () => {
    const decoded = decodeSubmitClaimResult({
      status: "queued",
      claim_id: "CLM-104",
      insurer_reference: "PAY-CLM-104",
      sanitized: true,
      pii_echoed: false
    });

    expect(decoded.status).toBe("queued");
    expect(decoded.insurer_reference).toBe("PAY-CLM-104");
    expect(decoded.sanitized).toBe(true);
    expect(decoded.pii_echoed).toBe(false);
  });

  it("throws on malformed submit output", () => {
    expect(() => decodeSubmitClaimResult({ status: "queued" })).toThrow(/missing/);
  });
});

describe("isVersionConflictError", () => {
  it("detects the T3N not-higher-than-current version error", () => {
    expect(
      isVersionConflictError(new Error("version 0.1.0 is not higher than current version 0.1.0"))
    ).toBe(true);
  });

  it("detects an already-registered version error", () => {
    expect(isVersionConflictError(new Error("contract version already registered"))).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isVersionConflictError(new Error("network unreachable"))).toBe(false);
  });

  it("renders a bump-version instruction", () => {
    expect(versionConflictHelp("0.1.0")).toMatch(/Bump the version/);
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
