import { afterEach, describe, expect, it, vi } from "vitest";
import { planAgentAction, planAgentActionLive } from "./planner";
import { demoClaims, demoGrant } from "@/lib/domain/seed";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("planAgentAction", () => {
  it("recommends protected approval for valid claims", () => {
    const claim = demoClaims.find((item) => item.id === "CLM-104")!;
    expect(planAgentAction(claim, demoGrant).recommendedDecision).toBe("approved");
  });

  it("recommends escalation for over-limit claims", () => {
    const claim = demoClaims.find((item) => item.id === "CLM-219")!;
    expect(planAgentAction(claim, demoGrant).recommendedDecision).toBe("needs_escalation");
  });

  it("uses OpenAI copy without changing the protected decision", async () => {
    process.env.OPENAI_API_KEY = "sk-test\n";
    process.env.CLAIMSPILOT_DEMO_MODE = "false";

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        output_text: `\`\`\`json\n${JSON.stringify({
          title: "Live agent says approve",
          message: "Proceed through the protected action rail.",
          privateDataHandling: "Only placeholders are used."
        })}\n\`\`\``
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const claim = demoClaims.find((item) => item.id === "CLM-219")!;
    const plan = await planAgentActionLive(claim, demoGrant);

    expect(plan.source).toBe("openai");
    expect(plan.title).toBe("Live agent says approve");
    expect(plan.recommendedDecision).toBe("needs_escalation");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer sk-test" }) })
    );
  });

  it("falls back when OpenAI is unavailable", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.CLAIMSPILOT_DEMO_MODE = "false";
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, text: async () => "bad key" })));

    const claim = demoClaims.find((item) => item.id === "CLM-104")!;
    const plan = await planAgentActionLive(claim, demoGrant);

    expect(plan.source).toBe("openai_fallback");
    expect(plan.recommendedDecision).toBe("approved");
    expect(plan.error).toBe("Live planner unavailable; deterministic policy copy shown.");
    expect(plan.error).not.toContain("bad key");
  });
});
