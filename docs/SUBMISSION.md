# ClaimsPilot Submission

## What It Is

ClaimsPilot is an AI insurance claims adjuster governed by Terminal 3 protected actions. It can inspect seeded claim context and recommend decisions, but payout execution requires scoped grants, policy checks, and audit logging.

## Problem

Claims automation is high-value but dangerous. Claims contain PII and financial authority. A compromised or hallucinating agent must not see raw identity data, submit arbitrary payouts, or bypass approval constraints.

## Terminal 3 Fit

ClaimsPilot uses the Terminal 3 pattern directly:

- verifiable agent identity
- user-authorized scoped actions
- TEE-style policy enforcement
- placeholder private data substitution
- allowed-host outbound action checks
- auditable allow/deny outcomes

## Demo Proof

The demo shows:

- approved low-value phone claim
- blocked high-value medical claim
- escalation request
- post-escalation approval
- revocation
- audit trail for every attempt
- T3 status panel for live SDK authentication
- OpenAI-backed live agent planner whose output cannot override protected policy decisions

## Build Track Scoring

| Criterion | Evidence |
| --- | --- |
| Completeness | Runnable Next.js app, live agent planner, seeded data, policy engine, grant UI, audit dashboard, mock insurer API, tests, docs |
| SDK integration | Terminal 3 SDK adapter, DID/token status, TEE contract kernel, protected-action architecture |
| Creativity | Insurance claims workflow with private last-mile execution and visible denial matrix |

## Bug Bounty Track

SDK/docs findings are documented separately in `BUGS.md` so the product pitch stays clean.
