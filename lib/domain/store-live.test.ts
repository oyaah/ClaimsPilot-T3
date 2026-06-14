import { afterEach, describe, expect, it, vi } from "vitest";
import { demoClaims, demoGrant } from "./seed";

const approvedClaim = demoClaims.find((c) => c.amountUsd <= demoGrant.maxAmountUsd)!;
const overLimitClaim = demoClaims.find((c) => c.amountUsd > demoGrant.maxAmountUsd)!;

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

async function loadStoreWithSource(mock: {
  source: "live" | "demo";
  invoke?: ReturnType<typeof vi.fn>;
}) {
  vi.resetModules();
  vi.doMock("@/lib/t3/decision-source", () => ({
    getDecisionSource: () => mock.source,
    evaluateClaimViaContract:
      mock.invoke ?? vi.fn(async () => ({ decision: "approved", reasons: [], scriptName: "z:tid:claims-policy", scriptVersion: "0.1.0", parityMatch: true, localDecision: "approved" }))
  }));
  const store = await import("./store");
  store.resetDemoState();
  return store;
}

describe("evaluateClaimWithSource", () => {
  it("uses the live contract decision and marks the audit row as live", async () => {
    const invoke = vi.fn(async () => ({
      decision: "approved" as const,
      reasons: [],
      scriptName: "z:tid:claims-policy",
      scriptVersion: "0.1.0",
      parityMatch: true,
      localDecision: "approved" as const
    }));
    const store = await loadStoreWithSource({ source: "live", invoke });

    const result = await store.evaluateClaimWithSource(approvedClaim.id);
    expect(invoke).toHaveBeenCalledOnce();
    expect(result.source).toBe("live");
    expect(result.decision).toBe("approved");

    const latest = store.listAudit()[0];
    expect(latest.mode).toBe("live");
    expect(latest.message).toContain("z:tid:claims-policy");
  });

  it("falls back to local policy and marks the audit row as error when the contract fails", async () => {
    const invoke = vi.fn(async () => {
      throw new Error("egress denied");
    });
    const store = await loadStoreWithSource({ source: "live", invoke });

    const result = await store.evaluateClaimWithSource(overLimitClaim.id);
    expect(result.source).toBe("error");
    // local oracle escalates an over-limit claim
    expect(result.decision).toBe("needs_escalation");

    const latest = store.listAudit()[0];
    expect(latest.mode).toBe("error");
    expect(latest.message).toContain("fell back to local");
  });

  it("uses the local demo path when source is demo", async () => {
    const invoke = vi.fn();
    const store = await loadStoreWithSource({ source: "demo", invoke });

    const result = await store.evaluateClaimWithSource(approvedClaim.id);
    expect(invoke).not.toHaveBeenCalled();
    expect(result.source).toBe("demo");
    expect(result.decision).toBe("approved");
  });
});
