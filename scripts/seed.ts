import { demoClaims, demoGrant } from "@/lib/domain/seed";

console.log(`Seeded ${demoClaims.length} demo claims.`);
console.log(`Default grant: ${demoGrant.id} ($${demoGrant.maxAmountUsd} cap).`);
console.log("ClaimsPilot uses in-memory demo state unless DATABASE_URL is wired during deployment.");

