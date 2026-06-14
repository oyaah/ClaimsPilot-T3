import { evaluateClaim } from "@/lib/domain/store";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const form = await request.formData();
  const claimId = String(form.get("claimId") ?? "");
  if (claimId) evaluateClaim(claimId);
  redirect("/");
}

