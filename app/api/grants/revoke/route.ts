import { revokeGrant } from "@/lib/domain/store";
import { redirect } from "next/navigation";

export async function POST() {
  revokeGrant();
  redirect("/dashboard/grants");
}

