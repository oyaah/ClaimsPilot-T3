import { describe, expect, it } from "vitest";
import { normalizeAgentDid } from "./seed";

describe("normalizeAgentDid", () => {
  it("adds the T3N DID prefix to a bare identifier", () => {
    expect(normalizeAgentDid("dc851f7d")).toBe("did:t3n:dc851f7d");
  });

  it("preserves an existing T3N DID", () => {
    expect(normalizeAgentDid("did:t3n:dc851f7d")).toBe("did:t3n:dc851f7d");
  });
});
