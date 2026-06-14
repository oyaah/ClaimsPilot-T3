import { describe, expect, it, vi } from "vitest";

describe("getT3Status", () => {
  it("falls back to demo mode when no key is configured", async () => {
    vi.resetModules();
    vi.stubEnv("T3N_API_KEY", "");
    const { getT3Status } = await import("./client");
    const status = await getT3Status();
    expect(status.mode).toBe("demo");
    expect(status.did).toContain("did:t3n");
  });
});

