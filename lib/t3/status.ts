export type T3StatusMode = "live" | "demo" | "error";

export type T3Status = {
  mode: T3StatusMode;
  did: string;
  address?: string;
  availableCredits?: number;
  environment: "testnet" | "production";
  message: string;
  checkedAt: string;
};

export function fallbackT3Status(message = "T3N_API_KEY is not configured."): T3Status {
  return {
    mode: "demo",
    did: process.env.NEXT_PUBLIC_T3_DID ?? "did:t3n:demo-claims-agent",
    environment: getT3Environment(),
    message,
    checkedAt: new Date().toISOString()
  };
}

export function getT3Environment(): "testnet" | "production" {
  return process.env.CLAIMSPILOT_T3_ENVIRONMENT === "production" ? "production" : "testnet";
}

