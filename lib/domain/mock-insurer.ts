type MockInsurerGlobal = typeof globalThis & {
  __claimsPilotPaidKeys?: Set<string>;
};

function paidKeys(): Set<string> {
  const shared = globalThis as MockInsurerGlobal;
  shared.__claimsPilotPaidKeys ??= new Set<string>();
  return shared.__claimsPilotPaidKeys;
}

export function registerPayout(idempotencyKey: string): "queued" | "duplicate_ignored" {
  const keys = paidKeys();
  if (keys.has(idempotencyKey)) return "duplicate_ignored";
  keys.add(idempotencyKey);
  return "queued";
}

export function resetMockInsurerState(): void {
  paidKeys().clear();
}
