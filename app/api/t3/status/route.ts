import { getT3Status } from "@/lib/t3/client";

export async function GET() {
  const status = await getT3Status();
  return Response.json(status);
}

