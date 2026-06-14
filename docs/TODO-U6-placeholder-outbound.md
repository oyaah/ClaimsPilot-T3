# TODO — U6: Placeholder-Outbound Insurer Call (next milestone)

Status: **not built** (deferred by design — policy-only contract ships first so
the live proof isn't blocked by profile/grant setup). Plan
`docs/plans/2026-06-15-001-feat-real-t3n-contract-plan.md` is still `status: active`
because of this unit.

## Code (≈30 min, no account setup needed — ships ready)

1. `contracts/claims-policy/wit/world.wit`: add
   `import host:interfaces/http-with-placeholders@2.1.0;` to the world.
2. Add a `submit-claim` function that templates `{{profile.*}}` markers into the
   insurer payload (NO raw PII as a contract argument) and calls
   `hwp::call(...)` — follow `Terminal-3/z-tenant-flight/src/booking.rs`
   (use `crate::host::interfaces::http_with_placeholders as hwp`, `Verb::Post`,
   `payload`, `headers: Some(...)` — NOT the stale docs snippet, see bug B1).
3. Keep `evaluate-claim` policy-only; `submit-claim` runs only after approval.
4. Version-bump: `Cargo.toml` + `CONTRACT_VERSION` (Rust) + `CONTRACT_VERSION`
   (`lib/t3/contract.ts`) → `0.2.0`. Rebuild + re-register.
5. App: add a `submitClaimViaContract` path behind approval; surface
   `host_not_allowed` / egress-denied as a first-class outcome (it's a feature).

Allowed placeholder markers (already the single source of truth in
`lib/domain/policy.ts` `PERMITTED_PLACEHOLDERS`):
`{{profile.first_name}}`, `{{profile.last_name}}`, `{{profile.date_of_birth}}`,
`{{profile.verified_contacts.email.value}}`.

## Live PII proof — needs setup on the testnet account (cannot be faked)

1. **User profile** with `first_name` / `last_name` / `date_of_birth` /
   verified email — via the OTP flow: `client.otpRequest` → `client.otpVerify`
   → `client.submitUserInput`.
2. **Grant** authorizing the contract's outbound insurer host for that user
   (allowed-hosts grant). Without it the call returns `egress_denied` — which is
   itself a valid demo of grant enforcement.
3. **Reachable insurer endpoint** the TEE can hit: `app/api/mock-insurer/*` must
   be publicly reachable (deploy per `docs/DEPLOYMENT.md`), or point at a real
   test URL.

## Expected outcomes to capture

- With profile + grant + reachable host: `submit-claim` resolves `{{profile.*}}`
  inside the TEE, calls the insurer, returns a sanitized confirmation — plaintext
  PII never enters WASM or agent context.
- Without the host grant: `host_not_allowed` / egress-denied, proving the caller
  grant (not a static app allowlist) authorizes egress.

## Definition of done

- WIT imports `http-with-placeholders`; `submit-claim` registered as `0.2.0`.
- Live run captured in `docs/LIVE-PROOF.md`: a resolved-PII insurer call AND an
  egress-denied case.
- Flip the plan to `status: completed`.
