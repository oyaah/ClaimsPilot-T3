# Judge Walkthrough

This is the shortest path to verify ClaimsPilot without reading the whole repo.

## 1. Open Live Proof

- Frontend: https://claimspilot-t3-bounty.vercel.app
- Backend audit: https://claimspilot-backend.onrender.com/dashboard/audit
- T3N status: https://claimspilot-backend.onrender.com/dashboard/t3-status

Use the Render backend links for proof because live T3N SDK and WASM calls run on the Node backend.

## 2. Verify The Terminal 3 Integration

Open [docs/LIVE-PROOF.md](LIVE-PROOF.md). Look for:

- registered script `z:dc851f7daab01b36a986b212e49673c2bc00f904:claims-policy@0.2.0`
- live `CLM-104` approved decision
- live `CLM-219` `needs_escalation` decision
- U6 placeholder outbound success:

```text
status: queued
claimId: CLM-104
insurerReference: PAY-CLM-104
sanitized: true
piiEchoed: false
```

- U6 allowed-host denial:

```text
egress denied for host example.com
```

## 3. What Makes It Real

ClaimsPilot uses:

- `@terminal3/t3n-sdk` live handshake/authenticate
- `tenant.contracts.register` for the WASM component
- `executeAndDecode` for live policy decisions
- `host:interfaces/http-with-placeholders@2.1.0` for private outbound calls
- T3N profile OTP and self-grant for allowed-host access
- deployed Vercel frontend + Render Node backend

## 4. What The Demo Proves

| Scenario | Expected result | Why it matters |
| --- | --- | --- |
| `CLM-104` phone claim, `$420` | Approved | Inside grant scope |
| `submit-claim` for `CLM-104` | `PAY-CLM-104`, sanitized | PII resolved through placeholders, not prompt/WASM |
| `CLM-219` medical claim, `$4,800` | Needs escalation | Agent cannot self-raise authority |
| outbound to `example.com` | Egress denied | User grant controls host access |

## 5. Where To Inspect Code

- [contracts/claims-policy/src/lib.rs](../contracts/claims-policy/src/lib.rs) - WASM export implementation
- [contracts/claims-policy/wit/world.wit](../contracts/claims-policy/wit/world.wit) - WIT import/export interface
- [lib/t3/decision-source.ts](../lib/t3/decision-source.ts) - live invoke and submit path
- [lib/domain/store.ts](../lib/domain/store.ts) - source-aware audit rows
- [lib/agent/planner.ts](../lib/agent/planner.ts) - OpenAI narrative boundary
