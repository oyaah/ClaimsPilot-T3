import { beforeEach, describe, expect, it } from "vitest";
import { registerPayout, resetMockInsurerState } from "./mock-insurer";

describe("mock insurer idempotency", () => {
  beforeEach(() => resetMockInsurerState());

  it("queues once and ignores a duplicate", () => {
    expect(registerPayout("claim:grant:420")).toBe("queued");
    expect(registerPayout("claim:grant:420")).toBe("duplicate_ignored");
  });

  it("can be reset for a clean recording", () => {
    registerPayout("claim:grant:420");
    resetMockInsurerState();
    expect(registerPayout("claim:grant:420")).toBe("queued");
  });
});
