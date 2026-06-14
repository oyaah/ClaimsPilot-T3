import { demoClaims, demoGrant } from "@/lib/domain/seed";
import { existsSync, readFileSync } from "node:fs";

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;

    const rows = readFileSync(file, "utf8").split(/\r?\n/);
    for (const row of rows) {
      const line = row.trim();
      if (!line || line.startsWith("#")) continue;

      const separator = line.indexOf("=");
      if (separator === -1) continue;

      const key = line.slice(0, separator).trim();
      const rawValue = line.slice(separator + 1).trim();
      if (!process.env[key]) {
        process.env[key] = rawValue.replace(/^["']|["']$/g, "");
      }
    }
  }
}

loadLocalEnv();

const failures: string[] = [];

if (demoClaims.length < 4) failures.push("Expected at least four seeded claims.");
if (!demoClaims.some((claim) => claim.amountUsd > demoGrant.maxAmountUsd)) {
  failures.push("Expected a seeded over-limit claim for denial demo.");
}
if (!demoGrant.allowedHosts.includes("mock-insurer.local")) {
  failures.push("Default grant must include mock-insurer.local allowed host.");
}
if (!process.env.T3N_API_KEY) {
  console.warn("[verify] T3N_API_KEY missing; live status will run in demo/error mode.");
}
if (process.env.CLAIMSPILOT_DEMO_MODE === "false" && !process.env.OPENAI_API_KEY) {
  console.warn("[verify] OPENAI_API_KEY missing; /dashboard/agent will use deterministic fallback.");
}
if (process.env.CLAIMSPILOT_DEMO_MODE === "false" && process.env.T3N_API_KEY) {
  console.log("[verify] Live T3 status is configured for", process.env.CLAIMSPILOT_T3_ENVIRONMENT ?? "testnet");
}
if (process.env.CLAIMSPILOT_DEMO_MODE === "false" && process.env.OPENAI_API_KEY) {
  console.log("[verify] Live OpenAI planner is configured with", process.env.OPENAI_MODEL ?? "gpt-4.1-mini");
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log("[verify] ClaimsPilot setup looks ready.");
