import { resetMockInsurerState } from "@/lib/domain/mock-insurer";
import { resetDemoState } from "@/lib/domain/store";
import { redirect } from "next/navigation";

export async function POST() {
  resetDemoState();
  resetMockInsurerState();
  redirect("/");
}
