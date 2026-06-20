import { registerPayout } from "@/lib/domain/mock-insurer";
import { z } from "zod";

const payoutSchema = z.object({
  claimId: z.string(),
  amountUsd: z.number().positive(),
  idempotencyKey: z.string().min(4),
  claimantRef: z.string(),
  claimant: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      dateOfBirth: z.string().optional(),
      email: z.string().optional()
    })
    .optional(),
  placeholders: z.array(z.string()).default([])
});

export async function POST(request: Request) {
  const parsed = payoutSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "invalid_payout_request", details: parsed.error.flatten() }, { status: 400 });
  }

  const status = registerPayout(parsed.data.idempotencyKey);
  if (status === "duplicate_ignored") {
    return Response.json({
      status: "duplicate_ignored",
      claimId: parsed.data.claimId,
      payoutReference: `PAY-${parsed.data.claimId}`
    });
  }

  return Response.json({
    status,
    claimId: parsed.data.claimId,
    amountUsd: parsed.data.amountUsd,
    payoutReference: `PAY-${parsed.data.claimId}`,
    sanitized: true,
    piiEchoed: false
  });
}
