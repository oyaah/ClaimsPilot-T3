import { listClaims } from "@/lib/domain/store";

export async function GET() {
  return Response.json({
    claims: listClaims().map((claim) => ({
      id: claim.id,
      type: claim.type,
      amountUsd: claim.amountUsd,
      status: claim.status,
      claimantDisplay: claim.claimantDisplay,
      sensitiveFields: claim.piiPlaceholders.map(() => "[placeholder]")
    }))
  });
}

