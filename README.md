# ClaimsPilot

**An insurance-claims AI agent that can investigate and recommend a claim decision — but can never approve a payout or touch a claimant's personal data on its own.** [Terminal 3](https://terminal3.io) (T3N) authenticates the actor, runs the decision contract, resolves private placeholders, and authorizes outbound hosts; ClaimsPilot maintains the human-managed policy envelope and application audit.

: **the agent recommends, the protected-action layer decides.**

## Submission links

| Surface | Link |
| --- | --- |
| Canonical live app | https://claimspilot-backend.onrender.com |
| Live T3N status | https://claimspilot-backend.onrender.com/dashboard/t3-status |
| Live audit | https://claimspilot-backend.onrender.com/dashboard/audit |
| Captured testnet proof | [docs/LIVE-PROOF.md](docs/LIVE-PROOF.md) |
| Bug-bounty findings | [BUGS.md](BUGS.md) |

---

## Why this exists

Insurance claims are a bad place to hand an AI agent full control. Every claim contains two sensitive things at the same time:

1. **Personal data** — name, date of birth, contact details, sometimes medical context.
2. **The authority to move money** — approving a claim means paying it out.

If you give a language model both directly, a single bad prompt, a jailbreak, or a compromised model can leak personal data or push through a wrong payout. Manual review is the safe answer, but it's slow and doesn't scale.

ClaimsPilot is the middle path. The agent does the useful work — reading the claim, writing a summary, recommending a decision — but the moment money or personal data is involved, control hands off to Terminal 3:

- The agent has a **verifiable T3N identity** (a DID), so every action is attributable.
- A human configures an **application grant** that scopes what the agent may do on its own: a payout cap, allowed claim types, and allowed regions. A T3N user grant separately authorizes the insurer host.
- The decision is made by a **real WebAssembly contract** running on Terminal 3, not by local code the agent could influence.
- Personal data is sent to the insurer using **placeholders**, resolved inside Terminal 3's protected environment — it never enters the AI prompt or the contract input.
- Every step is written to the **ClaimsPilot audit trail** with its decision source and outcome.

---

## How it works

```
                          ┌─────────────────────────────────────────┐
                          │              Claims operator             │
                          └───────────────────┬─────────────────────┘
                                              │
                          ┌───────────────────▼─────────────────────┐
                          │           ClaimsPilot dashboard          │
                          │  command · agent · grants · audit · t3   │
                          └───────────────────┬─────────────────────┘
                                              │
              ┌───────────────────────────────┼──────────────────────────────┐
              │                               │                              │
   ┌──────────▼──────────┐      ┌──────────────▼─────────────┐    ┌───────────▼──────────┐
   │   OpenAI planner     │      │ Application grant (limit)   │    │  Application audit   │
   │  writes the claim    │      │  cap · claim types · region │    │  every decision,     │
   │  summary + a         │      │  · insurer host · agent DID │    │  source, reason,     │
   │  recommendation only │      │  · expiry                   │    │  and outcome         │
   └──────────┬──────────┘      └──────────────┬─────────────┘    └───────────▲──────────┘
              │                                │                              │
              │   recommendation (advice)      │  policy envelope             │ writes rows
              └────────────────┬───────────────┘                              │
                               │                                              │
                  ┌────────────▼─────────────────────────────────────────────┴───┐
                  │            Terminal 3 WASM contract (claims-policy@0.2.0)    │
                  │                                                              │
                  │   evaluate-claim  ── policy only, NO PII ──►  approve /      │
                  │                                              needs_escalation/│
                  │                                              deny            │
                  │                                                              │
                  │   submit-claim ──► http-with-placeholders ──► resolves       │
                  │                    {{profile.*}} inside the enclave          │
                  └────────────────────────────┬─────────────────────────────────┘
                                               │ sanitized payout instruction
                                  ┌────────────▼────────────┐
                                  │      Insurer API        │
                                  │  returns payout ref,    │
                                  │  sanitized, no PII echo │
                                  └─────────────────────────┘
```

**The flow, in order:**

1. A claim lands in the queue. The OpenAI planner (GPT-4.1-mini) writes a plain-English summary and a recommended decision. That's advice — nothing is approved yet.
2. The operator runs the protected action. ClaimsPilot calls `evaluate-claim` on the live Terminal 3 contract, passing the claim and the active grant. **No personal data is in this call** — only the claim's structured facts and placeholder field names.
3. The contract returns one of three results: `approved`, `needs_escalation` (the amount is over the cap), or `denied` (some other rule failed).
4. If approved, ClaimsPilot calls `submit-claim`, which sends the payout instruction to the insurer through `http-with-placeholders`. The real name, DOB, and email are filled in by Terminal 3 just before the request leaves — the agent and the contract only ever see markers like `{{profile.first_name}}`.
5. The insurer returns a payout reference. Every step — the decision, its source, the reason, and the outcome — is written to ClaimsPilot's application audit.

---

## The protected-action model

Four layers stand between the agent and anything irreversible.

### 1. Identity (T3N DID)
On startup the app does a real Terminal 3 SDK handshake and authenticates, producing a live DID, wallet address, environment, and credit balance. If the handshake fails, the app reports an error state — it does not fake a live session. See `lib/t3/client.ts`.

### 2. The grant (the limit)
The application grant is the policy envelope a human sets for the agent. The seeded demo grant allows:

| Field | Value |
| --- | --- |
| Payout cap | `$750` autonomous |
| Claim types | `phone_damage`, `travel` |
| Regions | the grant's allowed region list |
| Insurer host | one allowed outbound host |
| Agent | a specific agent DID |
| Expiry | a validity window |

The app only submits actions that satisfy this envelope. A human can raise the cap through a deliberate application-audited escalation; the next protected decision still runs through the live T3N contract.

### 3. The policy contract
`evaluate-claim` checks the claim against the grant and returns a decision. The rules:

| Reason | Meaning | Result |
| --- | --- | --- |
| `amount_over_limit` | payout exceeds the cap | `needs_escalation` |
| `agent_not_authorized` | grant belongs to a different agent DID | `denied` |
| `grant_revoked` | the grant was revoked | `denied` |
| `grant_expired` | the grant's validity window passed | `denied` |
| `claim_type_not_allowed` | claim type or region outside scope | `denied` |
| `policy_inactive` | the claimant's policy isn't active | `denied` |
| `identity_not_verified` | claimant identity unverified | `denied` |
| `host_not_allowed` | destination host not in the grant | `denied` |
| `replay_rejected` | idempotency key already used | `denied` |
| `placeholder_not_permitted` | requested a profile field outside the allowed list | `denied` |

A claim is `approved` only when no reason fires. Over-limit is special-cased to `needs_escalation` so a human can choose to raise the cap, rather than a flat denial. The same rule set runs both in the WASM contract and as a local TypeScript "parity oracle" (`lib/domain/policy.ts`) so behavior can be verified identically on and off-chain.

### 4. Placeholder outbound + egress control
The payout call goes through `host:interfaces/http-with-placeholders@2.1.0`. The contract input contains only allowed markers:

- `{{profile.first_name}}`
- `{{profile.last_name}}`
- `{{profile.date_of_birth}}`
- `{{profile.verified_contacts.email.value}}`

Terminal 3 resolves these inside the enclave immediately before the HTTP call. On top of that, **egress is grant-controlled**: if the contract targets a host that isn't in the grant, Terminal 3 returns `egress denied`. Where data may go is decided by the user's grant, not by a hard-coded allowlist in the app.

---

## Terminal 3 integration

The decision and the approved-claim submit path run in a real Terminal 3 contract, not just local TypeScript.

`contracts/claims-policy` is a Rust crate compiled to a `wasm32-wasip2` component. Its WIT world:

```wit
world claims-policy {
    import host:interfaces/http-with-placeholders@2.1.0;
    export contracts;   // claimspilot:claims-policy/contracts@0.2.0
}

interface contracts {
    evaluate-claim: func(req: generic-input) -> result<list<u8>, string>;
    submit-claim:   func(req: generic-input) -> result<list<u8>, string>;
}
```

Registered on testnet as:

```
z:dc851f7daab01b36a986b212e49673c2bc00f904:claims-policy@0.2.0
```

The TypeScript side (`lib/t3/`) wraps the `@terminal3/t3n-sdk`: handshake/authenticate (`client.ts`), contract registration and invocation (`contract.ts`), decode helpers, and a decision-source tag (`live` vs `demo`) so the UI never claims live when it isn't.

---

## Project structure

```
app/
  page.tsx                  command center — claims queue + run actions
  dashboard/
    agent/                  OpenAI planner output (advisory only)
    grants/                 the application grant; escalate / revoke / reset
    audit/                  source-aware application audit
    t3-status/              live T3N handshake status
    docs/                   submission summary
  api/
    claims/evaluate/        run the protected action on a claim
    grants/escalate|revoke|reset/
    t3/status|contract/status|contract/invoke/
    mock-insurer/claims|payouts/   stand-in insurer endpoint
contracts/claims-policy/    Rust wasm32-wasip2 contract (evaluate-claim, submit-claim)
lib/
  t3/                       T3N SDK adapter: handshake, register, invoke, decode
  domain/                   seeded claims/grants, policy oracle, audit store
  agent/                    OpenAI planner (cannot override policy)
scripts/                    verify, seed, register contract, invoke contract
docs/                       LIVE-PROOF, SUBMISSION, DEPLOYMENT, TERMINAL3-INTEGRATION
```

---

## Tech stack

- **Next.js 16** (App Router) + **React 19**, **TypeScript**, **Tailwind CSS v4**
- **Zod** for input validation, **lucide-react** for icons
- **@terminal3/t3n-sdk** for identity, contract registration, and invocation
- **Rust** contract compiled to **wasm32-wasip2**
- **Vitest** for unit tests
- Deployed on **Render** (Node server, canonical live state) with a **Vercel** frontend mirror

---

## API reference

| Route | Method | What it does |
| --- | --- | --- |
| `/api/t3/status` | GET | Live T3N handshake status (mode, DID, credits) |
| `/api/t3/contract/status` | GET | Contract registration status (source, version) |
| `/api/t3/contract/invoke` | POST | Run `evaluate-claim` on a claim id |
| `/api/claims/evaluate` | POST | Protected action: evaluate + submit a claim |
| `/api/grants/escalate` | POST | Human raises the cap and reopens an escalated claim |
| `/api/grants/revoke` | POST | Revoke the agent's application grant |
| `/api/grants/reset` | POST | Reset demo state + idempotency cache |
| `/api/mock-insurer/claims` | POST | Stand-in insurer claim intake |
| `/api/mock-insurer/payouts` | POST | Stand-in insurer payout (returns reference) |

---

## Local quick start

```bash
npm install
npm run verify     # checks env + live wiring
npm test
npm run dev        # http://localhost:3000
```

For live T3N mode, copy `.env.example` to `.env.local`:

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

Without a `T3N_API_KEY`, the app runs in **demo mode** and labels every decision `demo` so it's never mistaken for live. Secrets are never committed — `.env.local` and `.claimspilot-state/` are gitignored.

### Contract commands

```bash
npm run t3:build-contract
npm run t3:register
npm run t3:invoke
```

Verify the built component interface:

```bash
wasm-tools component wit contracts/claims-policy/target/wasm32-wasip2/release/claims_policy.wasm
# import host:interfaces/http-with-placeholders@2.1.0
# export claimspilot:claims-policy/contracts@0.2.0
```

---

## Live deployment

| Surface | URL |
| --- | --- |
| Live app (canonical state) | https://claimspilot-backend.onrender.com |
| T3N status | https://claimspilot-backend.onrender.com/dashboard/t3-status |
| Audit trail | https://claimspilot-backend.onrender.com/dashboard/audit |
| Frontend mirror | https://claimspilot-t3-bounty.vercel.app |

The Render deployment owns the live Terminal 3 execution and audit state — use it for any real run. The Vercel deployment is a frontend mirror and keeps its own ephemeral state.

---

## Limitations

This is a live testnet build, not a production insurer system. A production version would:

- move audit and proof storage from local files to a database (e.g. Postgres),
- manage secrets through a cloud secret manager instead of env files,
- replace the mock insurer endpoint with a real partner API.

What is genuinely real here: live T3N authentication, a registered live WASM contract, live `evaluate-claim`/`submit-claim` invocation, placeholder-based outbound, and grant-controlled egress denial. Captured outputs are in [docs/LIVE-PROOF.md](docs/LIVE-PROOF.md).

---

## More

- [docs/TERMINAL3-INTEGRATION.md](docs/TERMINAL3-INTEGRATION.md) — integration deep dive
- [docs/LIVE-PROOF.md](docs/LIVE-PROOF.md) — captured live outputs
- [docs/SUBMISSION.md](docs/SUBMISSION.md) — judge-facing one-pager
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — deployment notes
- [BUG_REPORT.md](TERMINAL3_CLAIMSPILOT_CONFIRMED_BUG_REPORT.md)— Terminal 3 onboarding/SDK feedback report
- [BUGS.md](BUGS.md)- ledger (summary of bug report) 
