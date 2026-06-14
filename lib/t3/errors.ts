export function redactSecret(value: string): string {
  if (value.length <= 12) return "[redacted]";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function normalizeT3Error(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/0x[a-fA-F0-9]{32,}/g, "[redacted-key]");
}

