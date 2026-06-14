import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  PERMITTED_PLACEHOLDERS,
  evaluateClaimPolicy
} from "@/lib/domain/policy";
import type { Claim, Decision, DenialReason, Grant } from "@/lib/domain/types";
import { normalizeT3Error } from "./errors";
import { getT3Environment } from "./status";

/** Tenant-local contract name (NOT the canonical `z:<tid>:` name). */
export const CONTRACT_TAIL = "claims-policy";
/** Must match `contracts/claims-policy` `CONTRACT_VERSION` / `Cargo.toml`. */
export const CONTRACT_VERSION = "0.1.0";
/** Exported WIT function name. */
export const CONTRACT_FUNCTION = "evaluate-claim";

/** Sanitized policy envelope sent to the contract. Mirrors Rust `ClaimInput`. */
export type ClaimInput = {
  agent_did: string;
  grant_agent_did: string;
  claim_type: string;
  allowed_claim_types: string[];
  region: string;
  allowed_regions: string[];
  amount_usd: number;
  max_amount_usd: number;
  policy_active: boolean;
  requires_policy_active: boolean;
  identity_verified: boolean;
  requires_identity_verified: boolean;
  destination_host: string;
  allowed_hosts: string[];
  grant_revoked: boolean;
  grant_expired: boolean;
  replayed_nonce: boolean;
  pii_placeholders: string[];
  allowed_placeholders: string[];
};

/** Decoded contract response. Mirrors Rust `ClaimDecision`. */
export type ClaimDecision = {
  decision: Decision;
  reasons: DenialReason[];
};

/** Raised when live contract config (API key, etc.) is missing. */
export class T3ContractConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "T3ContractConfigError";
  }
}

/**
 * Validate a tenant-local contract tail. Rejects path separators and a
 * pre-canonicalized `z:<tid>:` name — the SDK canonicalizes the tail itself,
 * so callers must pass the local name only.
 */
export function validateContractTail(tail: string): string {
  if (!tail) throw new Error("contract tail is required");
  if (tail.includes("/")) {
    throw new Error(`contract tail must not contain '/': ${tail}`);
  }
  if (tail.includes(":")) {
    throw new Error(
      `contract tail must be a tenant-local name, not a canonical 'z:<tid>:' name: ${tail}`
    );
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(tail)) {
    throw new Error(`invalid contract tail (use lowercase, digits, hyphens): ${tail}`);
  }
  return tail;
}

/**
 * Prefer the authenticated session DID over any configured environment DID.
 * Tenant DID must never be derived from wallet material or hard-coded.
 */
export function tenantDidPreferSession(sessionDid?: string, envDid?: string): string {
  const session = sessionDid?.trim();
  if (session) return session;
  const env = envDid?.trim();
  if (env) return env;
  throw new T3ContractConfigError(
    "No tenant DID available: authenticate to T3N first (session DID is required)."
  );
}

/**
 * Build the sanitized `ClaimInput` for the contract from a Claim + Grant.
 * Carries no PII — only placeholder markers and policy scope.
 */
export function buildClaimInput(
  claim: Claim,
  grant: Grant,
  agentDid: string,
  opts: { replayed?: boolean } = {}
): ClaimInput {
  return {
    agent_did: agentDid,
    grant_agent_did: grant.agentDid,
    claim_type: claim.type,
    allowed_claim_types: grant.allowedClaimTypes,
    region: claim.region,
    allowed_regions: grant.allowedRegions,
    amount_usd: claim.amountUsd,
    max_amount_usd: grant.maxAmountUsd,
    policy_active: claim.policyStatus === "active",
    requires_policy_active: grant.requiresPolicyActive,
    identity_verified: claim.identityVerified,
    requires_identity_verified: grant.requiresIdentityVerified,
    destination_host: claim.destinationHost,
    allowed_hosts: grant.allowedHosts,
    grant_revoked: Boolean(grant.revokedAt),
    grant_expired: new Date(grant.expiresAt).getTime() < Date.now(),
    replayed_nonce: Boolean(opts.replayed),
    pii_placeholders: claim.piiPlaceholders,
    allowed_placeholders: [...PERMITTED_PLACEHOLDERS]
  };
}

const DECISIONS: Decision[] = ["approved", "denied", "needs_escalation"];

/** Validate + type a raw contract response into a `ClaimDecision`. */
export function decodeClaimDecision(raw: unknown): ClaimDecision {
  const value = typeof raw === "string" ? safeJsonParse(raw) : raw;
  if (!value || typeof value !== "object") {
    throw new Error("contract response is not an object");
  }
  const obj = value as Record<string, unknown>;
  const decision = obj.decision;
  if (typeof decision !== "string" || !DECISIONS.includes(decision as Decision)) {
    throw new Error(`contract response has invalid decision: ${String(decision)}`);
  }
  const reasons = Array.isArray(obj.reasons) ? obj.reasons.map(String) : [];
  return { decision: decision as Decision, reasons: reasons as DenialReason[] };
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`contract response is not valid JSON: ${normalizeT3Error(error)}`);
  }
}

/**
 * Compare a live contract decision against the local TypeScript policy oracle.
 * A mismatch is surfaced (never silently ignored) so rollout drift is visible.
 */
export function comparePolicyParity(
  contractDecision: ClaimDecision,
  claim: Claim,
  grant: Grant,
  agentDid: string,
  nonce?: string
): { match: boolean; localDecision: Decision } {
  const local = evaluateClaimPolicy(claim, grant, agentDid, new Set(), nonce);
  return {
    match: local.decision === contractDecision.decision,
    localDecision: local.decision
  };
}

type T3Sdk = typeof import("@terminal3/t3n-sdk");

export type AuthedContractContext = {
  sdk: T3Sdk;
  t3n: InstanceType<T3Sdk["T3nClient"]>;
  tenantClient: InstanceType<T3Sdk["TenantClient"]>;
  did: string;
  address: string;
  environment: "testnet" | "production";
  /** Canonical `z:<tid>:claims-policy` script name. */
  scriptName: string;
};

/**
 * Server-only: authenticate to T3N and build a TenantClient bound to the
 * authenticated session DID. Never logs or returns the API key.
 * Live network call — not exercised by unit tests.
 */
export async function createAuthenticatedT3Contract(): Promise<AuthedContractContext> {
  const key = process.env.T3N_API_KEY?.trim();
  if (!key) {
    throw new T3ContractConfigError("T3N_API_KEY is not configured.");
  }

  const sdk = (await import("@terminal3/t3n-sdk")) as T3Sdk;
  const environment = getT3Environment();
  sdk.setEnvironment(environment);

  const address = sdk.eth_get_address(key);
  const wasmPath = join(
    process.cwd(),
    "node_modules/@terminal3/t3n-sdk/dist/wasm/generated/session.core.wasm"
  );
  const t3n = new sdk.T3nClient({
    wasmComponent: await sdk.loadWasmComponent(existsSync(wasmPath) ? { wasmPath } : undefined),
    handlers: { EthSign: sdk.metamask_sign(address, undefined, key) }
  });

  await t3n.handshake();
  const didResult = await t3n.authenticate(sdk.createEthAuthInput(address));
  const sessionDid = String((didResult as { value?: string }).value ?? didResult);
  const did = tenantDidPreferSession(sessionDid, process.env.DID);

  const tenantClient = new sdk.TenantClient({ environment, t3n, tenantDid: did });
  const scriptName = sdk.canonicalTenantName(did, validateContractTail(CONTRACT_TAIL));

  return { sdk, t3n, tenantClient, did, address, environment, scriptName };
}
