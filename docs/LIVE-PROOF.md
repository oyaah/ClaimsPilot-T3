# Live Proof

Status: live SDK auth, live OpenAI planner, a real T3N contract registered +
invoked on testnet, and U6 placeholder outbound proved with both granted-host
success and ungranted-host denial.

The app reads `T3N_API_KEY`, `NEXT_PUBLIC_T3_DID`, and `OPENAI_API_KEY` from `.env.local`.

Verified on June 14, 2026:

- `/dashboard/t3-status` showed `LIVE`
- DID: `did:t3n:dc851f7daab01b36a986b212e49673c2bc00f904`
- Address: `0xf4238e96b10ea0dc7718ca7b3b51a795e2ce7c61`
- Environment: `testnet`
- Credits: `15365`
- SDK result: `Authenticated T3N session established.`
- `/dashboard/agent` used OpenAI source with model `gpt-4.1-mini`
- OpenAI live plan kept the protected decision as `approved` for `CLM-104`

## Real T3N contract proof (policy-only milestone)

The claims-policy contract builds as a real WASM component and registers/invokes
on T3N. Capture the sanitized output of these commands here:

```bash
npm run t3:build-contract
# verify it is a component:
wasm-tools component wit contracts/claims-policy/target/wasm32-wasip2/release/claims_policy.wasm
#   => export claimspilot:claims-policy/contracts@0.2.0;

npm run t3:register   # prints { tail, version, scriptName, environment, contractId }
npm run t3:invoke     # prints sanitized approved + escalated/denied live decisions
```

Local build proof (updated for U6 code, machine-independent):

- `cargo test --lib` -> 13/13 policy + submit tests pass
- `cargo build --target wasm32-wasip2 --release` -> `claims_policy.wasm`
- `wasm-tools component wit ...` -> imports
  `host:interfaces/http-with-placeholders@2.1.0` and exports
  `claimspilot:claims-policy/contracts@0.2.0` with `evaluate-claim` +
  `submit-claim`

### Live testnet register + invoke (captured 2026-06-15, sanitized — no keys, no PII)

Latest U6-ready registration (captured 2026-06-15, sanitized):

```text
[t3:register] read 199859 bytes ... claims_policy.wasm
[t3:register] authenticated tenant did:t3n:dc851f7daab01b36a986b212e49673c2bc00f904 on testnet
[t3:register] registering claims-policy@0.2.0 as z:dc851f7daab01b36a986b212e49673c2bc00f904:claims-policy
[t3:register] success:
  { "tail": "claims-policy", "version": "0.2.0",
    "scriptName": "z:dc851f7daab01b36a986b212e49673c2bc00f904:claims-policy",
    "environment": "testnet" }
```

Latest live invoke:

```text
[t3:invoke] approved claim CLM-104 ($420)
  { "source": "live-t3n",
    "scriptName": "z:dc851f7daab01b36a986b212e49673c2bc00f904:claims-policy",
    "scriptVersion": "0.2.0",
    "decision": "approved", "reasons": [], "localParity": "match" }

[t3:invoke] escalated/denied claim CLM-219 ($4800)
  { "source": "live-t3n",
    "scriptName": "z:dc851f7daab01b36a986b212e49673c2bc00f904:claims-policy",
    "scriptVersion": "0.2.0",
    "decision": "needs_escalation", "reasons": ["amount_over_limit"],
    "localParity": "match" }
```

Previous policy-only registration:

Registered on T3N testnet:

```text
[t3:register] read 162416 bytes ... claims_policy.wasm
[t3:register] authenticated tenant did:t3n:dc851f7daab01b36a986b212e49673c2bc00f904 on testnet
[t3:register] registering claims-policy@0.1.0 as z:dc851f7daab01b36a986b212e49673c2bc00f904:claims-policy
[t3:register] success:
  { "tail": "claims-policy", "version": "0.1.0",
    "scriptName": "z:dc851f7daab01b36a986b212e49673c2bc00f904:claims-policy",
    "environment": "testnet" }
```

Invoked live (decision came from the registered T3N contract, not local TS):

```text
[t3:invoke] approved claim CLM-104 ($420)
  { "source": "live-t3n",
    "scriptName": "z:dc851f7daab01b36a986b212e49673c2bc00f904:claims-policy",
    "scriptVersion": "0.1.0",
    "decision": "approved", "reasons": [], "localParity": "match" }

[t3:invoke] escalated/denied claim CLM-219 ($4800)
  { "source": "live-t3n",
    "scriptName": "z:dc851f7daab01b36a986b212e49673c2bc00f904:claims-policy",
    "scriptVersion": "0.1.0",
    "decision": "needs_escalation", "reasons": ["amount_over_limit"],
    "localParity": "match" }
```

`localParity: match` on both = the live TEE contract decision is identical to the
local policy oracle (`lib/domain/policy.ts`). The decision is enforced on T3N, not
in the app server.

## Placeholder outbound proof (U6)

Code path now exists:

- Contract export: `submit-claim(generic-input) -> result<list<u8>, string>`
- Host capability: `host:interfaces/http-with-placeholders@2.1.0`
- App path: after a live approved decision, `submitClaimViaContract` invokes
  `submit-claim` and writes a separate `claim.submit` audit row.

Before capture:

```bash
CLAIMSPILOT_INSURER_BASE_URL=https://your-public-app.example.com
npm run t3:build-contract
npm run t3:register
npm run dev
```

Then run approved claim `CLM-104` with `CLAIMSPILOT_DEMO_MODE=false`.

Expected no-grant proof:

```text
claim.submit -> denied
reason: host_not_allowed
message: T3N placeholder outbound denied by allowed-host grant: egress denied ...
```

Expected full success proof after T3N profile + allowed-host grant setup:

```text
claim.submit -> approved
message: Placeholder outbound z:<tenant>:claims-policy@0.2.0: queued (PAY-CLM-104)
```

Captured 2026-06-15 after T3N profile setup, verified email, and self-grant for
`claimspilot-backend.onrender.com`.

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

Audit row from deployed Render backend:

```text
claim.submit -> approved
message: Placeholder outbound z:dc851f7daab01b36a986b212e49673c2bc00f904:claims-policy@0.2.0: duplicate_ignored (PAY-CLM-104).
mode: live
```

The audit row is `duplicate_ignored` because the same claim was invoked twice
while smoke-testing Render and Vercel; the direct unique-key proof above returned
`queued`.

Ungranted-host denial:

```text
submit-claim -> denied
message: egress denied for host example.com
```

Do not paste resolved claimant names, DOB, emails, or raw profile output here.

Still capture before final submission:

- screenshot of `/dashboard/t3-status`
- screenshot of `/dashboard/agent` showing `OpenAI gpt-4.1-mini`
- screenshot of audit rows after protected actions (showing `live` source)

Do not paste raw API keys into this file.
