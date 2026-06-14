# ClaimsPilot

ClaimsPilot is a Terminal 3 ADK bounty build: an AI insurance claims agent that can investigate and submit claim decisions, while payout execution and private claimant data stay behind Terminal 3-style protected actions.

The agent can recommend. The protected-action layer decides.

## Why It Matters

Insurance claims are full of PII, approvals, and money movement. Giving an AI agent raw claimant identity, policy data, medical context, and payout authority is a bad security model. ClaimsPilot shows the safer pattern:

- agent identity through Terminal 3 / T3N
- scoped user grants for claim type, region, host, and payout cap
- TEE-style policy checks before execution
- `http-with-placeholders` style private data substitution
- audit rows for every allow, deny, escalation, and revocation

## Demo Flow

1. Open the command center.
2. Run `CLM-104`, a `$420` phone claim. It is approved.
3. Run `CLM-219`, a `$4,800` medical claim. It is blocked and marked for escalation.
4. Escalate the grant.
5. Retry the high-value claim.
6. Revoke the agent.
7. Verify old actions are blocked and audit rows explain why.

## Quick Start

```bash
npm install
npm run verify
npm run test
npm run dev
```

Open `http://localhost:3000`.

## Terminal 3 Setup

Copy `.env.example` to `.env.local` and set:

```bash
T3N_API_KEY=your_terminal3_sandbox_key
NEXT_PUBLIC_T3_DID=your_claimed_did
CLAIMSPILOT_T3_ENVIRONMENT=testnet
CLAIMSPILOT_DEMO_MODE=false
```

The app never commits local keys. If `T3N_API_KEY` is missing, the T3 status panel clearly shows demo mode.

## Live Agent Setup

Set these in `.env.local` to make `/dashboard/agent` use OpenAI for the claim narrative while the protected policy decision remains deterministic:

```bash
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4.1-mini
```

If `OPENAI_API_KEY` is missing, or `CLAIMSPILOT_DEMO_MODE=true`, the agent page uses the deterministic planner.

## Project Shape

- `app/` - Next.js app routes and dashboard pages
- `components/` - shared UI shell and status badges
- `lib/domain/` - claims, grants, audit, policy logic
- `lib/t3/` - Terminal 3 SDK adapter
- `lib/agent/` - deterministic claims-agent planner
- `contracts/claims-policy/` - Rust policy kernel for the T3N contract
- `docs/` - demo script and submission docs
- `BUGS.md` / `TERMINAL3_CLAIMSPILOT_CONFIRMED_BUG_REPORT.md` - verified SDK/docs bug-bounty report
- `HANDOFF.md` - teammate runbook and current live/demo context

## Bounty Alignment

| Criterion | ClaimsPilot evidence |
| --- | --- |
| Completeness | Runnable dashboard, seeded claims, grants, audit, agent planner, mock insurer API, tests, docs |
| SDK integration | T3 SDK adapter, DID status, TEE contract skeleton, protected action flow, placeholder-based PII design |
| Creativity | Insurance claims agent with private last-mile execution and visible denial matrix |
| Bug bounty | Separate reproducible issue ledger from real integration friction |

## Live vs Demo Boundary

Live:

- T3N SDK status uses the documented handshake/authenticate flow when `T3N_API_KEY` is present.
- The app surfaces DID, token usage, and SDK errors honestly.
- The agent dashboard uses OpenAI for live claim reasoning when `OPENAI_API_KEY` is present and demo mode is false.

Demo:

- Claims, grants, mock insurer, and audit rows use a seeded local JSON demo store.
- The Rust contract is a policy kernel ready for WIT/host binding integration.
- Placeholder substitution is represented in UI and payload design until a live contract is registered.

## No Raw PII In Agent Context

Claimant details use display names and references. Sensitive fields are represented as placeholders such as:

- `{{profile.first_name}}`
- `{{profile.last_name}}`
- `{{profile.date_of_birth}}`
- `{{profile.verified_contacts.email.value}}`

The agent-visible payload shows placeholders or redacted references, not raw identity data.
