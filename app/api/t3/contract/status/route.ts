import { readContractRegistration } from "@/lib/t3/contract-state";
import { getDecisionSource } from "@/lib/t3/decision-source";

export async function GET() {
  const registration = readContractRegistration();
  return Response.json({
    source: getDecisionSource(),
    registered: Boolean(registration),
    registration: registration
      ? {
          tail: registration.tail,
          version: registration.version,
          scriptName: registration.scriptName,
          environment: registration.environment,
          registeredAt: registration.registeredAt
        }
      : null
  });
}
