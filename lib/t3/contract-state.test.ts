import { afterEach, describe, expect, it, vi } from "vitest";

describe("contract-state", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns null when no registration file exists", async () => {
    vi.resetModules();
    vi.doMock("node:fs", () => ({
      existsSync: () => false,
      mkdirSync: () => undefined,
      readFileSync: () => "",
      writeFileSync: () => undefined
    }));
    const { readContractRegistration, hasContractRegistration } = await import("./contract-state");
    expect(readContractRegistration()).toBeNull();
    expect(hasContractRegistration()).toBe(false);
  });

  it("reads back persisted public-safe registration metadata", async () => {
    const stored = {
      tail: "claims-policy",
      version: "0.1.0",
      scriptName: "z:abcd:claims-policy",
      environment: "testnet",
      registeredAt: "2026-06-15T00:00:00.000Z",
      tenantDid: "did:t3n:tenant"
    };
    vi.resetModules();
    vi.doMock("node:fs", () => ({
      existsSync: () => true,
      mkdirSync: () => undefined,
      readFileSync: () => JSON.stringify(stored),
      writeFileSync: () => undefined
    }));
    const { readContractRegistration, hasContractRegistration } = await import("./contract-state");
    expect(readContractRegistration()).toEqual(stored);
    expect(hasContractRegistration()).toBe(true);
  });

  it("prefers public-safe env registration metadata in hosted deploys", async () => {
    vi.stubEnv("CLAIMSPILOT_CONTRACT_SCRIPT_NAME", "z:envtid:claims-policy");
    vi.stubEnv("CLAIMSPILOT_CONTRACT_VERSION", "0.2.0");
    vi.stubEnv("CLAIMSPILOT_CONTRACT_TENANT_DID", "did:t3n:envtid");
    vi.stubEnv("CLAIMSPILOT_T3_ENVIRONMENT", "testnet");
    vi.resetModules();
    vi.doMock("node:fs", () => ({
      existsSync: () => false,
      mkdirSync: () => undefined,
      readFileSync: () => "",
      writeFileSync: () => undefined
    }));

    const { readContractRegistration, hasContractRegistration } = await import("./contract-state");
    expect(readContractRegistration()).toMatchObject({
      tail: "claims-policy",
      version: "0.2.0",
      scriptName: "z:envtid:claims-policy",
      environment: "testnet",
      tenantDid: "did:t3n:envtid"
    });
    expect(hasContractRegistration()).toBe(true);
  });

  it("returns null on a corrupt registration file", async () => {
    vi.resetModules();
    vi.doMock("node:fs", () => ({
      existsSync: () => true,
      mkdirSync: () => undefined,
      readFileSync: () => "{ not json",
      writeFileSync: () => undefined
    }));
    const { readContractRegistration } = await import("./contract-state");
    expect(readContractRegistration()).toBeNull();
  });
});
