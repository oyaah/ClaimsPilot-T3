# ClaimsPilot Submission

## What It Is

ClaimsPilot is an AI insurance claims adjuster governed by Terminal 3 protected actions. It can inspect claim context and recommend decisions, but payout execution requires scoped grants, a live T3N WASM contract, placeholder private-data substitution, allowed-host egress authorization, and audit logging.

Live app: https://claimspilot-t3-bounty.vercel.app

Live proof backend: https://claimspilot-backend.onrender.com

## Problem

Claims automation is high-value but dangerous. Claims contain PII and financial authority. A compromised or hallucinating agent must not see raw identity data, submit arbitrary payouts, or bypass approval constraints.

## Terminal 3 Fit

ClaimsPilot uses the Terminal 3 pattern directly:

- verifiable agent identity
- user-authorized scoped actions and self-grants
- real T3N contract registration and `executeAndDecode`
- `wasm32-wasip2` policy contract enforcement
- `http-with-placeholders` private data substitution
- allowed-host outbound action checks
- auditable allow/deny outcomes

## Demo Proof

The demo shows:

- approved low-value phone claim
- blocked high-value phone replacement claim
- human escalation request that reopens the claim
- live post-escalation approval
- revocation
- audit trail for every attempt
- T3 status panel for live SDK authentication
- OpenAI-backed live agent planner whose output cannot override protected policy decisions
- U6 placeholder outbound success: `PAY-CLM-104`, `sanitized: true`, `piiEchoed: false`
- U6 denied-host proof: `egress denied for host example.com`

## Build Track Scoring

| Criterion | Evidence |
| --- | --- |
| Completeness | Live Vercel app, Render Node backend, agent planner, seeded claims, grants UI, audit dashboard, mock insurer API, tests, docs |
| SDK integration | T3N SDK auth, live DID/credits, `tenant.contracts.register`, `executeAndDecode`, real WASM contract, OTP profile setup, self-grant, `http-with-placeholders` |
| Creativity | Insurance claims workflow with private last-mile payout execution and visible denial matrix |
| Trust | The model writes narrative only; T3N controls policy, placeholder resolution, egress, and auditability |

## Bug Bounty Track

SDK/docs findings are documented separately in `BUGS.md` so the product pitch stays clean.
