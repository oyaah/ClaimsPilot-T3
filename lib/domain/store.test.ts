import { beforeEach, describe, expect, it } from "vitest";
import {
  escalateGrantForClaim,
  evaluateClaim,
  getActiveGrant,
  getClaim,
  listAudit,
  resetDemoState,
  revokeGrant
} from "./store";

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

  it("reopens an escalated claim for approval under the raised cap", () => {
    expect(evaluateClaim("CLM-219").decision).toBe("needs_escalation");
    escalateGrantForClaim("CLM-219");

    expect(getClaim("CLM-219")?.status).toBe("open");
    expect(evaluateClaim("CLM-219").decision).toBe("approved");
  });
});
