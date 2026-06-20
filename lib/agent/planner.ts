import { evaluateClaimPolicy, primaryReason, describeReason } from "@/lib/domain/policy";
import type { Claim, Decision, Grant } from "@/lib/domain/types";
import { DEFAULT_AGENT_DID } from "@/lib/domain/seed";

export type AgentPlan = {
  title: string;
  message: string;
  recommendedDecision: Decision;
  privateDataHandling: string;
  source: "deterministic" | "openai" | "openai_fallback";
  model?: string;
  error?: string;
};

export function planAgentAction(claim: Claim, grant: Grant): AgentPlan {
  const decision = evaluateClaimPolicy(claim, grant, DEFAULT_AGENT_DID);
  const reason = primaryReason(decision);

  if (decision.decision === "approved") {
    return {
      title: "Approve through protected action",
      message: `The claim is inside the delegated policy. Submit it through the T3N protected-action path, not directly from the agent.`,
      recommendedDecision: "approved",
      privateDataHandling: `${claim.piiPlaceholders.length} profile placeholders resolved outside agent context`,
      source: "deterministic"
    };
  }

  if (decision.decision === "needs_escalation") {
    return {
      title: "Request escalation",
      message: `${describeReason(reason)} The agent should request a higher grant before retrying.`,
      recommendedDecision: "needs_escalation",
      privateDataHandling: "No raw PII required for escalation",
      source: "deterministic"
    };
  }

  return {
    title: "Deny or send for human review",
    message: describeReason(reason),
    recommendedDecision: "denied",
    privateDataHandling: "Sensitive fields remain placeholder-only",
    source: "deterministic"
  };
}

type OpenAiPlanPayload = {
  title?: string;
  message?: string;
  privateDataHandling?: string;
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export function shouldUseLiveAgent(): boolean {
  return Boolean(getOpenAiApiKey()) && process.env.CLAIMSPILOT_DEMO_MODE !== "true";
}

export async function planAgentActionLive(claim: Claim, grant: Grant): Promise<AgentPlan> {
  const guardedPlan = planAgentAction(claim, grant);
  if (!shouldUseLiveAgent()) return guardedPlan;

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
  const apiKey = getOpenAiApiKey();

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: [
              "You are ClaimsPilot, an insurance claims agent.",
              "You recommend the next action, but you must not override the protected policy decision.",
              "Never request or expose raw PII. Refer only to placeholders and claimant references.",
              "Return only compact JSON with title, message, and privateDataHandling."
            ].join(" ")
          },
          {
            role: "user",
            content: JSON.stringify({
              claim: {
                id: claim.id,
                type: claim.type,
                region: claim.region,
                amountUsd: claim.amountUsd,
                status: claim.status,
                policyStatus: claim.policyStatus,
                identityVerified: claim.identityVerified,
                claimantRef: claim.claimantId,
                piiPlaceholders: claim.piiPlaceholders,
                evidence: claim.evidence,
                summary: claim.summary
              },
              grant: {
                id: grant.id,
                maxAmountUsd: grant.maxAmountUsd,
                allowedClaimTypes: grant.allowedClaimTypes,
                allowedRegions: grant.allowedRegions,
                allowedHosts: grant.allowedHosts,
                requiresIdentityVerified: grant.requiresIdentityVerified,
                requiresPolicyActive: grant.requiresPolicyActive,
                revoked: Boolean(grant.revokedAt)
              },
              protectedPolicyDecision: guardedPlan.recommendedDecision,
              deterministicGuardrail: {
                title: guardedPlan.title,
                message: guardedPlan.message,
                privateDataHandling: guardedPlan.privateDataHandling
              }
            })
          }
        ],
        temperature: 0.2,
        max_output_tokens: 300
      })
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`OpenAI ${response.status}: ${details.slice(0, 180)}`);
    }

    const data = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    const text = data.output_text ?? data.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("").trim();
    if (!text) throw new Error("OpenAI response did not include output text.");

    const parsed = JSON.parse(extractJson(text)) as OpenAiPlanPayload;
    return {
      ...guardedPlan,
      title: sanitizeAgentText(parsed.title) || guardedPlan.title,
      message: sanitizeAgentText(parsed.message) || guardedPlan.message,
      privateDataHandling: sanitizeAgentText(parsed.privateDataHandling) || guardedPlan.privateDataHandling,
      source: "openai",
      model
    };
  } catch (error) {
    console.warn(`[planner] OpenAI fallback (${classifyAgentError(error)})`);
    return {
      ...guardedPlan,
      source: "openai_fallback",
      model,
      error: normalizeAgentError(error)
    };
  }
}

function sanitizeAgentText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/0x[a-fA-F0-9]{32,}/g, "[redacted]").trim().slice(0, 280);
}

function extractJson(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function normalizeAgentError(error: unknown): string {
  void error;
  return "Live planner unavailable; deterministic policy copy shown.";
}

function classifyAgentError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const status = message.match(/^OpenAI (\d{3}):/);
  if (status) return `http_${status[1]}`;
  if (message.includes("invalid header value")) return "invalid_api_key_header";
  return "transport_or_parse_error";
}

function getOpenAiApiKey(): string {
  return process.env.OPENAI_API_KEY?.replace(/\s+/g, "") ?? "";
}
