# claims-policy

ClaimsPilot's protected claim contract for Terminal 3 / T3N.

A Rust → `wasm32-wasip2` **WASM component** that runs inside the Trinity TEE and
decides **allow / deny / needs-escalation** for an insurance claim, then submits
approved claims through Terminal 3 placeholder outbound HTTP.

## Decision + Placeholder Submit

`evaluate-claim` is policy-only. Its input is the sanitized policy envelope
(`policy::ClaimInput`) — amounts, claim type, region, grant scope,
identity/host flags. It contains **no** claimant name, document, or contact
data.

`submit-claim` is the U6 proof layer. It templates `{{profile.*}}` markers into
the insurer payload and calls `host:interfaces/http-with-placeholders`, so
plaintext claimant PII is resolved inside the TEE and never enters WASM memory
or the agent prompt.

## Interface

```wit
package claimspilot:claims-policy@0.2.0;

world claims-policy {
  import host:interfaces/http-with-placeholders@2.1.0;
  export contracts;
}

interface contracts {
  record generic-input { input: option<list<u8>>, user-profile: option<list<u8>>, context: option<list<u8>> }
  evaluate-claim: func(req: generic-input) -> result<list<u8>, string>;
  submit-claim: func(req: generic-input) -> result<list<u8>, string>;
}
```

- `evaluate-claim` input JSON: `ClaimInput` (sanitized policy envelope).
- `evaluate-claim` output JSON: `ClaimDecision { decision, reasons }`, with `decision` one of
  `approved | denied | needs_escalation` and snake_case `reasons`.
- `submit-claim` input JSON: `SubmitClaimInput` (URL, claim metadata,
  idempotency key, and placeholder markers only).
- `submit-claim` output JSON: `SubmitClaimResult { status, claim_id,
  insurer_reference }`.

The decision logic is a 1:1 parity oracle for `lib/domain/policy.ts`, so the app
can compare live contract output against the local policy during rollout.

## Build

```bash
rustup target add wasm32-wasip2
cargo build --target wasm32-wasip2 --release
# => target/wasm32-wasip2/release/claims_policy.wasm
```

Verify the component interface:

```bash
wasm-tools component wit target/wasm32-wasip2/release/claims_policy.wasm
# => export claimspilot:claims-policy/contracts@0.2.0;
```

## Test (native)

```bash
cargo test --lib
```

The pure policy logic in `src/policy.rs` is native-testable; the WASM `Guest`
impl in `src/lib.rs` is gated behind `#[cfg(target_arch = "wasm32")]`.

## Register + invoke

From the repo root:

```bash
npm run t3:register   # scripts/t3-register-contract.ts
npm run t3:invoke     # scripts/t3-invoke-contract.ts
```

See [Terminal 3 integration](../../docs/TERMINAL3-INTEGRATION.md) and
[live proof](../../docs/LIVE-PROOF.md).
