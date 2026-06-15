import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Public-safe registration metadata persisted after a successful
 * `tenant.contracts.register`. Contains NO API keys or secrets — only the
 * contract identity needed to invoke it later.
 */
export type ContractRegistration = {
  tail: string;
  version: string;
  scriptName: string;
  environment: "testnet" | "production";
  /** Contract identifier returned by registration, when the SDK provides one. */
  contractId?: string;
  registeredAt: string;
  /** Authenticated tenant DID at registration time. */
  tenantDid: string;
};

function stateDir(): string {
  const dir = join(process.cwd(), ".claimspilot-state");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function statePath(): string {
  return join(stateDir(), "contract.json");
}

export function readContractRegistration(): ContractRegistration | null {
  const envRegistration = readEnvContractRegistration();
  if (envRegistration) return envRegistration;

  const file = statePath();
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as ContractRegistration;
  } catch {
    return null;
  }
}

export function writeContractRegistration(registration: ContractRegistration): void {
  writeFileSync(statePath(), `${JSON.stringify(registration, null, 2)}\n`);
}

export function hasContractRegistration(): boolean {
  return readContractRegistration() !== null;
}

function readEnvContractRegistration(): ContractRegistration | null {
  const scriptName = process.env.CLAIMSPILOT_CONTRACT_SCRIPT_NAME?.trim();
  const tenantDid = process.env.CLAIMSPILOT_CONTRACT_TENANT_DID?.trim() || process.env.DID?.trim();
  if (!scriptName || !tenantDid) return null;

  return {
    tail: process.env.CLAIMSPILOT_CONTRACT_TAIL?.trim() || "claims-policy",
    version: process.env.CLAIMSPILOT_CONTRACT_VERSION?.trim() || "0.2.0",
    scriptName,
    environment: process.env.CLAIMSPILOT_T3_ENVIRONMENT === "production" ? "production" : "testnet",
    contractId: process.env.CLAIMSPILOT_CONTRACT_ID?.trim() || undefined,
    registeredAt: process.env.CLAIMSPILOT_CONTRACT_REGISTERED_AT?.trim() || new Date(0).toISOString(),
    tenantDid
  };
}
