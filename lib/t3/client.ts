import { existsSync } from "node:fs";
import { join } from "node:path";
import { normalizeT3Error } from "./errors";
import { fallbackT3Status, getT3Environment, type T3Status } from "./status";

type T3Sdk = typeof import("@terminal3/t3n-sdk");

export async function getT3Status(): Promise<T3Status> {
  const key = process.env.T3N_API_KEY?.trim();
  if (!key) {
    return fallbackT3Status();
  }

  try {
    const sdk = (await import("@terminal3/t3n-sdk")) as T3Sdk;
    const environment = getT3Environment();
    sdk.setEnvironment(environment);

    const address = sdk.eth_get_address(key);
    const wasmPath = join(process.cwd(), "node_modules/@terminal3/t3n-sdk/dist/wasm/generated/session.core.wasm");
    const client = new sdk.T3nClient({
      wasmComponent: await sdk.loadWasmComponent(existsSync(wasmPath) ? { wasmPath } : undefined),
      handlers: {
        EthSign: sdk.metamask_sign(address, undefined, key)
      }
    });

    await client.handshake();
    const did = await client.authenticate(sdk.createEthAuthInput(address));
    const usage = await client.getUsage();

    return {
      mode: "live",
      did: String((did as { value?: string }).value ?? did),
      address,
      availableCredits: Number((usage as { balance?: { available?: number } }).balance?.available ?? 0),
      environment,
      message: "Authenticated T3N session established.",
      checkedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      ...fallbackT3Status(),
      mode: "error",
      message: normalizeT3Error(error)
    };
  }
}
