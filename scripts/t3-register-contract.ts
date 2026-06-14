/**
 * Register the built claims-policy WASM component on T3N testnet.
 *
 *   npm run t3:register
 *
 * Prerequisites:
 *   - `cargo build --target wasm32-wasip2 --release` in contracts/claims-policy
 *   - T3N_API_KEY set (in .env.local) for the target environment
 *
 * Writes public-safe registration metadata to .claimspilot-state/contract.json.
 * Never prints the API key.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadLocalEnv } from "./load-env";
import {
  CONTRACT_TAIL,
  CONTRACT_VERSION,
  createAuthenticatedT3Contract,
  isVersionConflictError,
  validateContractTail,
  versionConflictHelp
} from "@/lib/t3/contract";
import { writeContractRegistration } from "@/lib/t3/contract-state";
import { normalizeT3Error } from "@/lib/t3/errors";

const WASM_PATH = join(
  process.cwd(),
  "contracts/claims-policy/target/wasm32-wasip2/release/claims_policy.wasm"
);

function fail(message: string): never {
  console.error(`[t3:register] ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  loadLocalEnv();

  if (!existsSync(WASM_PATH)) {
    fail(
      `Built WASM not found at ${WASM_PATH}. Build it first:\n` +
        "  (cd contracts/claims-policy && cargo build --target wasm32-wasip2 --release)"
    );
  }
  if (!process.env.T3N_API_KEY?.trim()) {
    fail("T3N_API_KEY is not configured. Set it in .env.local before registering.");
  }

  const tail = validateContractTail(CONTRACT_TAIL);
  const wasm = new Uint8Array(readFileSync(WASM_PATH));
  console.log(`[t3:register] read ${wasm.byteLength} bytes from ${WASM_PATH}`);

  const ctx = await createAuthenticatedT3Contract();
  console.log(`[t3:register] authenticated tenant ${ctx.did} on ${ctx.environment}`);
  console.log(`[t3:register] registering ${tail}@${CONTRACT_VERSION} as ${ctx.scriptName}`);

  let result: unknown;
  try {
    result = await ctx.tenantClient.contracts.register({
      tail,
      version: CONTRACT_VERSION,
      wasm
    });
  } catch (error) {
    if (isVersionConflictError(error)) {
      fail(versionConflictHelp(CONTRACT_VERSION));
    }
    fail(`registration failed: ${normalizeT3Error(error)}`);
  }

  const contractId =
    result && typeof result === "object" && "id" in result
      ? String((result as { id?: unknown }).id)
      : undefined;

  writeContractRegistration({
    tail,
    version: CONTRACT_VERSION,
    scriptName: ctx.scriptName,
    environment: ctx.environment,
    contractId,
    registeredAt: new Date().toISOString(),
    tenantDid: ctx.did
  });

  console.log("[t3:register] success. Public-safe summary:");
  console.log(
    JSON.stringify(
      { tail, version: CONTRACT_VERSION, scriptName: ctx.scriptName, environment: ctx.environment, contractId },
      null,
      2
    )
  );
  console.log("[t3:register] wrote .claimspilot-state/contract.json. Run: npm run t3:invoke");
}

main().catch((error) => fail(normalizeT3Error(error)));
