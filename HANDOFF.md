# ClaimsPilot Handoff For Parshiv

## Current State

ClaimsPilot is a Terminal 3 ADK bounty build for an AI insurance claims agent.

The important story:

- OpenAI writes the claim-agent narrative on `/dashboard/agent`.
- Terminal 3/T3N verifies live DID/token status on `/dashboard/t3-status`.
- The agent cannot approve payouts directly.
- Protected policy checks enforce grant scope, amount limits, identity verification, host allowlists, revocation, and audit logging.

## Repo Status

Branch: `codex/claimspilot-build`

Primary files:

- `README.md` - setup, demo, architecture summary
- `plan.md` - original build plan and bounty strategy
- `docs/DEMO-SCRIPT.md` - recording walkthrough
- `docs/SUBMISSION.md` - submission pitch
- `docs/TERMINAL3-INTEGRATION.md` - T3 SDK integration notes
- `docs/LIVE-PROOF.md` - live verification evidence
- `BUGS.md` - bug bounty index
- `TERMINAL3_CLAIMSPILOT_CONFIRMED_BUG_REPORT.md` - detailed confirmed bug report
- `contracts/claims-policy/` - Rust policy-kernel skeleton

## Local Env

Secrets are intentionally not committed.

For live mode, create `.env.local`:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
T3N_API_KEY=...
NEXT_PUBLIC_T3_DID=...
DID=...
CLAIMSPILOT_T3_ENVIRONMENT=testnet
CLAIMSPILOT_DEMO_MODE=false
```

For demo/offline recording:

```bash
CLAIMSPILOT_DEMO_MODE=true
```

Do not commit `.env.local`. It is gitignored.

## Run It

```bash
npm install
npm run verify
npm test
npm run dev
```

Open:

```text
http://localhost:3000
```

## Verified Live Behavior

As of June 14, 2026:

- `/dashboard/agent` showed `live OpenAI planner`
- Agent cards showed `OpenAI gpt-4.1-mini`
- `/dashboard/t3-status` showed `LIVE`
- T3 status returned the expected DID, address, testnet environment, credits, and authenticated-session message

Full local checks passed:

```bash
npm run verify
npm test
npm run lint
npm run typecheck
npm run build
```

## Demo Flow For Recording

Use `docs/DEMO-SCRIPT.md`, but the short version is:

1. Open `/dashboard/agent`.
2. Point out live OpenAI planner.
3. Say OpenAI can write reasoning, but cannot override protected policy decisions.
4. Open `/`.
5. Run `CLM-104`; it should approve.
6. Run `CLM-219`; it should need escalation because the amount exceeds the grant.
7. Open `/dashboard/grants`; escalate the grant.
8. Retry `CLM-219`; it should approve.
9. Revoke the grant.
10. Open `/dashboard/audit`; show every allow/deny/escalate/revoke row.
11. Open `/dashboard/t3-status`; show live T3 status.

## Architecture

Core flow:

```text
OpenAI agent narrative
  -> deterministic policy guardrail
  -> Terminal 3 style protected action
  -> grant/policy decision
  -> sanitized mock insurer action
  -> audit row
```

The policy decision lives in:

- `lib/domain/policy.ts`
- `lib/domain/store.ts`
- `contracts/claims-policy/src/lib.rs`

The live SDK adapter lives in:

- `lib/t3/client.ts`

The live OpenAI planner lives in:

- `lib/agent/planner.ts`

## Important Implementation Notes

- The app uses a local JSON demo store under `.claimspilot-state/`; this folder is ignored.
- `@terminal3/t3n-sdk` is externalized in `next.config.ts` so Next/Turbopack does not break WASM loading.
- The T3 SDK adapter passes the shipped WASM path explicitly.
- OpenAI output is parsed defensively because the API may wrap JSON in markdown fences.
- OpenAI can change title/message/private-data wording only; it cannot change `recommendedDecision`.

## Real T3N Contract Path (new)

- `contracts/claims-policy` is now a real `wasm32-wasip2` WASM component
  exporting `claimspilot:claims-policy/contracts@0.1.0` (verified with
  `wasm-tools component wit`). Native policy tests: `cargo test --lib` (10/10).
- `npm run t3:build-contract` → build WASM; `npm run t3:register` → register on
  testnet (writes public-safe `.claimspilot-state/contract.json`);
  `npm run t3:invoke` → live approved + escalated/denied proof.
- App is source-aware (`lib/t3/decision-source.ts`): live T3N contract when
  configured + registered, else local demo; audit rows mark `live`/`demo`/`error`.
- Still policy-only: the `http-with-placeholders` insurer call is the next
  milestone (see `docs/TERMINAL3-INTEGRATION.md`).
- Deployment: see `docs/DEPLOYMENT.md` (Vercel+Render minimum, Cloud Run prod).

## Known Issues / Risks

- `npm audit --omit=dev` still reports moderate transitive advisories from Next/PostCSS and Terminal3 SDK -> ethers/ws. No direct app dependency fix is available without breaking changes.
- The contract is real and registrable, but the **placeholder outbound** insurer
  call is not yet wired (policy-only first, by design).
- Live `t3:register` / `t3:invoke` testnet output still needs to be pasted into
  `docs/LIVE-PROOF.md` from a machine with the configured key.
- Keys pasted into chat should be rotated before anything public. This is not optional.

## Suggested Next Moves

1. Run `npm run t3:build-contract && npm run t3:register && npm run t3:invoke`; paste sanitized output into `docs/LIVE-PROOF.md`.
2. Record the demo with live mode first; backup demo with `CLAIMSPILOT_DEMO_MODE=true`.
3. Add screenshots to `docs/LIVE-PROOF.md` (t3-status, agent, audit `live` rows).
4. Submit build + `BUGS.md` separately so the product pitch stays clean.
5. Submit `TERMINAL3_CLAIMSPILOT_CONFIRMED_BUG_REPORT.md` for the bug track.
6. Add the `http-with-placeholders` insurer milestone (U6).
