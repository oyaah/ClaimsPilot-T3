# TODO — U6: Placeholder-Outbound Insurer Call (next milestone)

Status: **complete**. The contract/app path is wired for `submit-claim` through
`http-with-placeholders`, and live proof is captured with both granted-host
success and ungranted-host denial. Plan
`docs/plans/2026-06-15-001-feat-real-t3n-contract-plan.md` is now complete.

## Code (done)

1. `contracts/claims-policy/wit/world.wit` imports
   `host:interfaces/http-with-placeholders@2.1.0`.
2. `submit-claim` templates `{{profile.*}}` markers into the insurer payload
   and calls `hwp::call(...)`; raw PII fields are rejected.
3. `evaluate-claim` stays policy-only; `submit-claim` runs only after live approval.
4. Version bumped to `0.2.0` in Cargo, Rust, and TS.
5. App writes a separate `claim.submit` audit row and surfaces egress denial as
   `host_not_allowed`, not as a direct HTTP fallback.

Allowed placeholder markers (already the single source of truth in
`lib/domain/policy.ts` `PERMITTED_PLACEHOLDERS`):
`{{profile.first_name}}`, `{{profile.last_name}}`, `{{profile.date_of_birth}}`,
`{{profile.verified_contacts.email.value}}`.

## Live PII proof — completed on the testnet account

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
- Plan flipped to `status: completed`.
