import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
});

async function loadWithRegistration(registered: boolean) {
  vi.resetModules();
  vi.doMock("./contract-state", () => ({
    hasContractRegistration: () => registered,
    readContractRegistration: () => (registered ? { scriptName: "z:tid:claims-policy", version: "0.1.0" } : null)
  }));
  return import("./decision-source");
}

describe("getDecisionSource", () => {
  it("is live when not demo mode, key set, and registration exists", async () => {
    vi.stubEnv("CLAIMSPILOT_DEMO_MODE", "false");
    vi.stubEnv("T3N_API_KEY", "0xabc");
    const { getDecisionSource } = await loadWithRegistration(true);
    expect(getDecisionSource()).toBe("live");
  });

  it("is demo when demo mode is on, even with key + registration", async () => {
    vi.stubEnv("CLAIMSPILOT_DEMO_MODE", "true");
    vi.stubEnv("T3N_API_KEY", "0xabc");
    const { getDecisionSource } = await loadWithRegistration(true);
    expect(getDecisionSource()).toBe("demo");
  });

  it("is demo when no API key", async () => {
    vi.stubEnv("CLAIMSPILOT_DEMO_MODE", "false");
    vi.stubEnv("T3N_API_KEY", "");
    const { getDecisionSource } = await loadWithRegistration(true);
    expect(getDecisionSource()).toBe("demo");
  });

  it("is demo when no registration exists", async () => {
    vi.stubEnv("CLAIMSPILOT_DEMO_MODE", "false");
    vi.stubEnv("T3N_API_KEY", "0xabc");
    const { getDecisionSource } = await loadWithRegistration(false);
    expect(getDecisionSource()).toBe("demo");
  });
});
