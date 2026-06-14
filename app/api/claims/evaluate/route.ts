import { evaluateClaimWithSource } from "@/lib/domain/store";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const form = await request.formData();
  const claimId = String(form.get("claimId") ?? "");
  // Source-aware: live T3N contract when configured + registered, else local demo.
  if (claimId) await evaluateClaimWithSource(claimId);
  redirect("/");
}

