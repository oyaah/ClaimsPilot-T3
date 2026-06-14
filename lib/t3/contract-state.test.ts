import { afterEach, describe, expect, it, vi } from "vitest";

describe("contract-state", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
