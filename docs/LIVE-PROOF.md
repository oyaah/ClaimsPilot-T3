# Live Proof

Status: live SDK auth, live OpenAI planner, AND a real T3N contract registered +
invoked on testnet (see "Live testnet register + invoke" below).

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
#   => export claimspilot:claims-policy/contracts@0.1.0;

npm run t3:register   # prints { tail, version, scriptName, environment, contractId }
npm run t3:invoke     # prints sanitized approved + escalated/denied live decisions
```

Local build proof (already captured, machine-independent):

- `cargo test --lib` -> 10/10 policy tests pass
- `cargo build --target wasm32-wasip2 --release` -> `claims_policy.wasm` (~162 KB)
- `wasm-tools component wit ...` -> `export claimspilot:claims-policy/contracts@0.1.0;`

### Live testnet register + invoke (captured 2026-06-15, sanitized — no keys, no PII)

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

Still capture before final submission:

- screenshot of `/dashboard/t3-status`
- screenshot of `/dashboard/agent` showing `OpenAI gpt-4.1-mini`
- screenshot of audit rows after protected actions (showing `live` source)

Do not paste raw API keys into this file.
