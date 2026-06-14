import { beforeEach, describe, expect, it } from "vitest";
import { evaluateClaim, getActiveGrant, listAudit, resetDemoState, revokeGrant } from "./store";

describe("demo store", () => {
  beforeEach(() => resetDemoState());

  it("writes audit rows for claim decisions", () => {
    const before = listAudit().length;
    const result = evaluateClaim("CLM-104");
    expect(result.decision).toBe("approved");
    expect(listAudit()).toHaveLength(before + 1);
  });

  it("revocation blocks later action", () => {
    revokeGrant();
    expect(getActiveGrant().revokedAt).toBeTruthy();
    const result = evaluateClaim("CLM-104");
    expect(result.reasons).toContain("grant_revoked");
  });
});

