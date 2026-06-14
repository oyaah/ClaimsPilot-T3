/**
 * Invoke the registered claims-policy contract on T3N for an approved claim
 * and an escalated/denied claim, printing sanitized live proof.
 *
 *   npm run t3:invoke
 *
 * Reads .claimspilot-state/contract.json (run `npm run t3:register` first).
 * Compares each live decision against the local policy oracle and warns —
 * never hides — a mismatch. Prints no PII or secrets.
 */
import { loadLocalEnv } from "./load-env";
import { demoClaims, demoGrant, DEFAULT_AGENT_DID } from "@/lib/domain/seed";
import type { Claim } from "@/lib/domain/types";
import {
  CONTRACT_FUNCTION,
  buildClaimInput,
  comparePolicyParity,
  createAuthenticatedT3Contract,
  decodeClaimDecision
} from "@/lib/t3/contract";
import { readContractRegistration } from "@/lib/t3/contract-state";
import { normalizeT3Error } from "@/lib/t3/errors";

function fail(message: string): never {
  console.error(`[t3:invoke] ${message}`);
  process.exit(1);
}

const approvedClaim = demoClaims.find((c) => c.amountUsd <= demoGrant.maxAmountUsd);
const overLimitClaim = demoClaims.find((c) => c.amountUsd > demoGrant.maxAmountUsd);

async function main(): Promise<void> {
  loadLocalEnv();

  const registration = readContractRegistration();
  if (!registration) {
    fail("No registration found. Run `npm run t3:register` first.");
  }
  if (!process.env.T3N_API_KEY?.trim()) {
    fail("T3N_API_KEY is not configured. Set it in .env.local before invoking.");
  }
  if (!approvedClaim || !overLimitClaim) {
    fail("Seed data is missing an approved or over-limit claim.");
  }

  const ctx = await createAuthenticatedT3Contract();
  if (ctx.scriptName !== registration.scriptName) {
    console.warn(
      `[t3:invoke] session script name ${ctx.scriptName} differs from registered ${registration.scriptName}; using registered.`
    );
  }

  // Resolve the current registered version (handles "latest").
  let scriptVersion = registration.version;
  try {
    scriptVersion = await ctx.sdk.getScriptVersion(ctx.sdk.getNodeUrl(), registration.scriptName);
  } catch (error) {
    console.warn(
      `[t3:invoke] getScriptVersion failed (${normalizeT3Error(error)}); falling back to ${registration.version}`
    );
  }

  for (const [label, claim] of [
    ["approved", approvedClaim],
    ["escalated/denied", overLimitClaim]
  ] as Array<[string, Claim]>) {
    const input = buildClaimInput(claim, demoGrant, DEFAULT_AGENT_DID);
    const raw = await ctx.t3n.executeAndDecode({
      script_name: registration.scriptName,
      script_version: scriptVersion,
      function_name: CONTRACT_FUNCTION,
      input
    });

    const decoded = decodeClaimDecision(raw);
    const parity = comparePolicyParity(decoded, claim, demoGrant, DEFAULT_AGENT_DID);

    console.log(`\n[t3:invoke] ${label} claim ${claim.id} ($${claim.amountUsd})`);
    console.log(
      JSON.stringify(
        {
          source: "live-t3n",
          scriptName: registration.scriptName,
          scriptVersion,
          decision: decoded.decision,
          reasons: decoded.reasons,
          localParity: parity.match ? "match" : `MISMATCH (local=${parity.localDecision})`
        },
        null,
        2
      )
    );
    if (!parity.match) {
      console.warn(`[t3:invoke] WARNING: live decision disagrees with local policy oracle for ${claim.id}`);
    }
  }

  console.log("\n[t3:invoke] done. Paste the sanitized output above into docs/LIVE-PROOF.md.");
}

main().catch((error) => fail(normalizeT3Error(error)));
