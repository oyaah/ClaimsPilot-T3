import { getClaim, escalateGrant } from "@/lib/domain/store";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const form = await request.formData();
  const claimId = String(form.get("claimId") ?? "");
  const claim = getClaim(claimId);
  if (claim) {
    escalateGrant(Math.max(5000, Math.ceil(claim.amountUsd / 100) * 100), claim.type);
  }
  redirect("/dashboard/grants");
}

