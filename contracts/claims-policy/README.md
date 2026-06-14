# claims-policy

ClaimsPilot's protected claim-decision contract for Terminal 3 / T3N.

A Rust → `wasm32-wasip2` **WASM component** that runs inside the Trinity TEE and
decides **allow / deny / needs-escalation** for an insurance claim against the
caller's delegated grant.

## Policy-only — carries no PII

This contract is the first proof milestone: a real, registrable, invocable T3N
contract that enforces the claim decision off the app server. Its input is the
sanitized policy envelope only (`policy::ClaimInput`) — amounts, claim type,
region, grant scope, identity/host flags. It contains **no** claimant name,
document, or contact data.

The PII-bearing insurer call is a separate, later milestone (`U6`) that uses
`host:interfaces/http-with-placeholders` so plaintext claimant PII is resolved
inside the TEE and never enters WASM memory or the agent prompt.

## Interface

```wit
package claimspilot:claims-policy@0.1.0;

world claims-policy {
  export contracts;
}

interface contracts {
  record generic-input { input: option<list<u8>>, user-profile: option<list<u8>>, context: option<list<u8>> }
  evaluate-claim: func(req: generic-input) -> result<list<u8>, string>;
}
```

- Input JSON: `ClaimInput` (sanitized policy envelope).
- Output JSON: `ClaimDecision { decision, reasons }`, with `decision` one of
  `approved | denied | needs_escalation` and snake_case `reasons`.

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
# => export claimspilot:claims-policy/contracts@0.1.0;
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

See `docs/TERMINAL3-INTEGRATION.md` and `docs/LIVE-PROOF.md`.
