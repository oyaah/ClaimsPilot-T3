# ClaimsPilot

ClaimsPilot is a live Terminal 3 ADK insurance-claims agent. The AI can investigate and recommend a claim decision, but payout execution and claimant PII are controlled by T3N identity, user grants, a real WASM contract, placeholder outbound HTTP, and an audit trail.

The agent can recommend. The protected-action layer decides.

## Live Submission

| Surface | Link |
| --- | --- |
| Live app | https://claimspilot-t3-bounty.vercel.app |
| Live backend proof | https://claimspilot-backend.onrender.com |
| T3N status | https://claimspilot-backend.onrender.com/dashboard/t3-status |
| Audit proof | https://claimspilot-backend.onrender.com/dashboard/audit |
| Submission one-pager | [docs/SUBMISSION.md](docs/SUBMISSION.md) |
| Live proof log | [docs/LIVE-PROOF.md](docs/LIVE-PROOF.md) |
| Demo video script | [docs/VIDEO-SCRIPT.md](docs/VIDEO-SCRIPT.md) |
| Bug bounty report | [BUGS.md](BUGS.md) |

## Problem

Insurance claims are full of PII, approvals, and money movement. A useful claims agent needs enough context to help, but it should not hold raw identity data or unlimited payout authority. A compromised or hallucinating model must not be able to submit arbitrary payouts.

ClaimsPilot shows the safer pattern:

- live T3N DID authentication for the agent/operator
- scoped grants for claim type, region, host, and payout cap
- a real `wasm32-wasip2` Terminal 3 contract for policy decisions
- `http-with-placeholders` for the PII-bearing insurer call
- allowed-host egress enforcement by the user's grant
- audit rows for allow, deny, escalation, revocation, and submit outcomes

## What Judges Should See

1. Open the live app and run `CLM-104`, a `$420` phone claim.
   - Expected: live approved policy decision.
   - Audit adds `claim.approve`.
2. Open Audit.
   - Expected: live `claim.submit` row from `submit-claim`.
   - U6 proof captured: `PAY-CLM-104`, `sanitized: true`, `piiEchoed: false`.
3. Open T3 status.
   - Expected: `LIVE`, DID `did:t3n:dc851f7daab01b36a986b212e49673c2bc00f904`, testnet credits.
4. Run or discuss `CLM-219`, a `$4,800` medical claim.
   - Expected: `needs_escalation` because the agent cannot self-raise its grant.
5. Review [docs/LIVE-PROOF.md](docs/LIVE-PROOF.md).
   - Shows registered `claims-policy@0.2.0`, approved/escalated live invokes, U6 success, and ungranted-host denial.

## Terminal 3 Integration

The claim decision and approved-claim submit path run in a real Terminal 3 contract, not just local TypeScript.

`contracts/claims-policy` compiles to a `wasm32-wasip2` WASM component exporting:

```text
claimspilot:claims-policy/contracts@0.2.0
  evaluate-claim(...)
  submit-claim(...)
```

The registered testnet contract is:

```text
z:dc851f7daab01b36a986b212e49673c2bc00f904:claims-policy@0.2.0
```

`evaluate-claim` is policy-only and carries no PII. After a live approval, `submit-claim` sends the insurer payload through `host:interfaces/http-with-placeholders@2.1.0`. The WASM input contains only placeholder markers:

- `{{profile.first_name}}`
- `{{profile.last_name}}`
- `{{profile.date_of_birth}}`
- `{{profile.verified_contacts.email.value}}`

T3N resolves those inside the enclave just before outbound HTTP. The contract and agent never receive plaintext profile values.

## Live Proof Captured

U6 placeholder outbound is complete.

Granted-host success:

```text
submit-claim -> approved
script: z:dc851f7daab01b36a986b212e49673c2bc00f904:claims-policy@0.2.0
status: queued
claimId: CLM-104
insurerReference: PAY-CLM-104
sanitized: true
piiEchoed: false
```

Ungranted-host denial:

```text
submit-claim -> denied
message: egress denied for host example.com
```

That denial matters: the outbound host is authorized by the user's grant, not by a hard-coded app allowlist.

## Architecture

```text
Claims manager
  -> ClaimsPilot dashboard
  -> OpenAI planner writes narrative only
  -> T3N contract evaluate-claim enforces grant/policy
  -> T3N http-with-placeholders resolves profile markers in enclave
  -> Mock insurer API receives sanitized payout instruction
  -> Audit trail records decision, source, script, and reason
```

Core files:

- `contracts/claims-policy/` - Rust WASM contract with `evaluate-claim` and `submit-claim`
- `lib/t3/` - T3N SDK adapter, contract registration, invoke, decode helpers
- `lib/domain/` - seeded claims, grants, policy parity oracle, audit store
- `lib/agent/` - OpenAI-backed planner whose output cannot override policy
- `app/dashboard/*` - command, agent, grants, audit, T3 status, submission pages
- `docs/LIVE-PROOF.md` - sanitized live outputs

## Demo Flow

Use [docs/VIDEO-SCRIPT.md](docs/VIDEO-SCRIPT.md) for the 4-5 minute recording.

Short version:

1. Start with the problem: claims automation is useful, but raw PII plus payout authority is dangerous.
2. Show live T3 status.
3. Show the registered contract and U6 proof in `docs/LIVE-PROOF.md`.
4. Run `CLM-104` and show approval plus `claim.submit`.
5. Run or explain `CLM-219` and show escalation.
6. Close on the core point: the model writes the narrative; T3N controls the action.

## Local Quick Start

```bash
npm install
npm run verify
npm test
npm run dev
```

Open `http://localhost:3000`.

For live T3N mode, copy `.env.example` to `.env.local` and set:

```bash
T3N_API_KEY=...
OPENAI_API_KEY=...
NEXT_PUBLIC_T3_DID=did:t3n:dc851f7daab01b36a986b212e49673c2bc00f904
CLAIMSPILOT_T3_ENVIRONMENT=testnet
CLAIMSPILOT_DEMO_MODE=false
CLAIMSPILOT_INSURER_BASE_URL=https://claimspilot-backend.onrender.com
CLAIMSPILOT_CONTRACT_SCRIPT_NAME=z:dc851f7daab01b36a986b212e49673c2bc00f904:claims-policy
CLAIMSPILOT_CONTRACT_VERSION=0.2.0
CLAIMSPILOT_CONTRACT_TENANT_DID=did:t3n:dc851f7daab01b36a986b212e49673c2bc00f904
```

Secrets are never committed. `.env.local` and `.claimspilot-state/` are gitignored.

## Contract Commands

```bash
npm run t3:build-contract
npm run t3:register
npm run t3:invoke
```

Verify the component interface:

```bash
wasm-tools component wit contracts/claims-policy/target/wasm32-wasip2/release/claims_policy.wasm
```

Expected:

```text
import host:interfaces/http-with-placeholders@2.1.0
export claimspilot:claims-policy/contracts@0.2.0
```

## Bounty Alignment

| Criterion | ClaimsPilot evidence |
| --- | --- |
| Completeness | Live Next.js app, Render Node backend, claims queue, grants UI, audit dashboard, OpenAI planner, mock insurer API, tests, deployment docs |
| SDK integration | T3N SDK handshake/authenticate, live DID/credits, `tenant.contracts.register`, `executeAndDecode`, real WASM component, user profile OTP, self-grant, placeholder outbound |
| Creativity | Insurance claims workflow with private last-mile payout execution and visible denial matrix |
| Trust story | The agent does not see raw PII or hold unlimited payout authority; Terminal 3 enforces identity, grants, egress, and auditability |
| Bug track | Separate source-verified SDK/docs report in [BUGS.md](BUGS.md) |

## Honest Boundary

This is a bounty-grade live testnet deployment, not an insurer production system. The production path would move audit/proof storage to Postgres, manage secrets with a cloud secret manager, and replace the mock insurer endpoint with a partner API. The Terminal 3 control path is real: live auth, live contract registration/invoke, live placeholder outbound, and live grant-denied egress proof are captured.
