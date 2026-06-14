import { existsSync, readFileSync } from "node:fs";

/**
 * Minimal .env loader for tsx scripts (no dotenv dependency). Reads
 * `.env.local` then `.env`, without overriding already-set process env.
 * Never logs values.
 */
export function loadLocalEnv(): void {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const row of readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = row.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator === -1) continue;
      const key = line.slice(0, separator).trim();
      const rawValue = line.slice(separator + 1).trim();
      if (!process.env[key]) {
        process.env[key] = rawValue.replace(/^["']|["']$/g, "");
      }
    }
  }
}
