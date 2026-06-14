import { evaluateClaimWithSource } from "@/lib/domain/store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { claimId?: string };
  const claimId = body.claimId?.trim();
  if (!claimId) {
    return Response.json({ error: "claimId is required" }, { status: 400 });
  }

  try {
    const result = await evaluateClaimWithSource(claimId);
    return Response.json({
      claimId,
      source: result.source,
      decision: result.decision,
      reasons: result.reasons
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
