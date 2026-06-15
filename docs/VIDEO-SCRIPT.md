# ClaimsPilot Demo Video Script

Target length: **4-5 minutes**.

Use this after recording the live app and before uploading the final YouTube link to the bounty form. Do not show `.env.local`, API keys, OTPs, raw profile values, or terminal history containing secrets.

## Recording Setup

Open these before recording:

| Window | URL / file | Purpose |
| --- | --- | --- |
| Browser tab 1 | `https://claimspilot-t3-bounty.vercel.app` | Live frontend |
| Browser tab 2 | `https://claimspilot-backend.onrender.com/dashboard/t3-status` | Live T3N status |
| Browser tab 3 | `https://claimspilot-backend.onrender.com/dashboard/audit` | Live audit proof |
| Editor tab 1 | `README.md` | Architecture and judge links |
| Editor tab 2 | `docs/LIVE-PROOF.md` | Sanitized live proof |
| Editor tab 3 | `contracts/claims-policy/wit/world.wit` | WIT import/export proof |

## Segment 1 — Hook (0:00-0:40)

Say:

> Claims automation is valuable, but it is also dangerous. A claim contains identity data, policy data, sometimes medical context, and payout authority. If we give an AI agent all of that directly, a prompt bug or compromised model can leak PII or submit a bad payout.
>
> ClaimsPilot is the safer pattern: the AI can investigate and recommend, but Terminal 3 controls the action.

Show:

- Live app home page.
- Point at the claims queue and active grant.

## Segment 2 — Why Terminal 3 (0:40-1:30)

Say:

> The protected path has four parts. First, a live T3N identity. Second, a user grant that scopes claim type, payout cap, region, and outbound host. Third, a real T3N WASM contract that evaluates the claim. Fourth, `http-with-placeholders`, so profile fields are resolved inside the enclave instead of entering the agent prompt or WASM input.

Show:

- `docs/LIVE-PROOF.md`
- The registered script:

```text
z:dc851f7daab01b36a986b212e49673c2bc00f904:claims-policy@0.2.0
```

- `contracts/claims-policy/wit/world.wit`, especially:

```text
import host:interfaces/http-with-placeholders@2.1.0
export contracts
```

## Segment 3 — Live Status Proof (1:30-2:00)

Show:

- `https://claimspilot-backend.onrender.com/dashboard/t3-status`

Say:

> This is live testnet status from the T3N SDK handshake and authentication flow. The app shows the DID, wallet address, environment, and current credits. If the SDK fails, the app says so; it does not fake live mode.

## Segment 4 — Approved Claim + Placeholder Submit (2:00-3:10)

Show:

- Live app home page.
- Run `CLM-104`.
- Open audit page.

Say:

> This is a $420 phone claim, inside the grant. The policy decision is approved by the live T3N contract, not by the OpenAI planner. After approval, ClaimsPilot invokes `submit-claim`, which builds an insurer payload using only placeholders like `{{profile.first_name}}` and `{{profile.verified_contacts.email.value}}`.
>
> The audit row shows the protected submit. The captured direct proof returned `PAY-CLM-104`, `sanitized: true`, and `piiEchoed: false`.

If the audit row says `duplicate_ignored`, say:

> This says duplicate ignored because the same claim was smoke-tested twice. That is the idempotency guard working; the unique-key proof in `docs/LIVE-PROOF.md` returned `queued`.

## Segment 5 — Denied / Escalated Claim (3:10-3:50)

Show:

- Run or point at `CLM-219`.
- Open audit or explain the result.

Say:

> Now the medical claim is $4,800. The agent can ask, but it cannot self-approve. The contract returns `needs_escalation` because the amount is over the current grant.
>
> We also proved outbound denial separately: pointing the contract at ungranted `example.com` returns `egress denied`. That matters because egress is authorized by the user grant, not by a static app allowlist.

## Segment 6 — OpenAI Boundary (3:50-4:25)

Show:

- `/dashboard/agent`

Say:

> OpenAI is used for the claim narrative, not the final decision. It can explain the recommendation, but it cannot override the T3N contract, grant cap, allowed host, or audit outcome.

## Segment 7 — Close (4:25-5:00)

Say:

> ClaimsPilot is not a chat UI with a security sticker. It is a live protected-action claims workflow: T3N identity, user-scoped grants, a real WASM contract, private placeholder substitution, allowed-host egress checks, and auditability. The agent writes the narrative. Terminal 3 controls the action.

End on:

- README live submission links, or
- Audit page with `claim.approve` and `claim.submit` live rows.
