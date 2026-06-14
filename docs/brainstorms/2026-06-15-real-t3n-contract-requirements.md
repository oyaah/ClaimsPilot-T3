---
date: 2026-06-15
topic: real-t3n-contract
---

# Real T3N Contract Publish/Invoke Requirements

## Summary

ClaimsPilot will add a real Terminal 3 contract path: the Rust claims policy compiles as a `wasm32-wasip2` WASM component, registers under the tenant with `TenantClient`, and can be invoked live on T3N for claim decisions. The first winning proof is live publish/invoke evidence; hosted deployment comes second, with Vercel+Render as the bare-minimum launch path and Cloud Run as the production-grade follow-up.

---

## Problem Frame

ClaimsPilot already proves live T3N authentication and a live OpenAI planner, but the protected claim decision still runs locally in TypeScript. That leaves the submission exposed to the obvious judge question: where is the actual Terminal 3 contract execution?

The new bounty criteria reward completeness and Agent Auth SDK integration. A real contract registration and invocation path changes the story from "Terminal 3 styled demo" to "Terminal 3 enforced insurance action." For insurers, the same proof matters because policy enforcement, auditability, scoped action authority, and sensitive-data boundaries must survive outside a demo server.

---

## Key Decisions

- **Live T3N proof first:** The build should prioritize compiling, registering, and invoking the claims policy on T3N before adding more dashboard polish.
- **Policy-only invoke is the first proof milestone:** If user grant or profile setup blocks outbound egress, a live policy decision invoke still counts as the first non-mock T3N proof.
- **Placeholder outbound calls are the second proof milestone:** The follow-up proof should use `http-with-placeholders` for insurer-facing calls so raw claimant PII stays out of agent prompts and WASM inputs.
- **Vercel+Render is the bare-minimum deploy path:** Use Vercel for the Next.js UI and Render for the Node SDK/backend worker when speed matters for the hackathon.
- **Cloud Run is the production target:** Cloud Run with managed Postgres, Secret Manager, and task queues is the stronger insurer-facing story because it keeps runtime, secrets, audit, jobs, and IAM under one cloud boundary.

---

## Actors

- A1. **ClaimsPilot agent:** The AI agent that recommends claim actions but cannot override protected policy decisions.
- A2. **Insurance operator:** The reviewer or claims team member who needs proof that the agent's action path is bounded and auditable.
- A3. **Terminal 3 tenant:** The authenticated tenant DID that owns the contract namespace and registration lifecycle.
- A4. **Data owner or self-granting caller:** The identity whose grant controls which contract functions and outbound hosts may be used.
- A5. **Insurer system:** The destination API that receives sanitized claim or payout actions after contract approval.

---

## Requirements

**Contract proof**

- R1. ClaimsPilot must build the Rust claims policy as a WASI Preview 2 component using the `wasm32-wasip2` target.
- R2. ClaimsPilot must add a `wit/world.wit` contract world that exports callable claim functions through the `contracts` interface.
- R3. The contract must accept JSON bytes through Terminal 3's `generic-input` envelope and return JSON bytes or an error string.
- R4. The first live proof must show a tenant contract registration result with contract tail, version, script name, and returned contract identifier when available.
- R5. The first live proof must show a contract invocation result for at least one approved claim and one denied or escalated claim.

**SDK integration**

- R6. Registration must use an authenticated `TenantClient` after `T3nClient.handshake()` and `authenticate(createEthAuthInput(address))`.
- R7. Tenant DID must be read from the authenticated session, not derived from the wallet or hard-coded.
- R8. Contract tails must remain tenant-local names and must not include `z:<tid>:` or path separators.
- R9. Invocation must use the SDK's live execution path rather than local TypeScript policy evaluation.

**Insurance action safety**

- R10. The OpenAI planner may change explanation text but must not change the protected policy decision returned by the contract path.
- R11. Raw claimant PII must not be sent to OpenAI, contract input, logs, committed docs, or demo proof files.
- R12. The placeholder outbound milestone must use Terminal 3 host placeholder resolution for claimant fields before calling an insurer endpoint.
- R13. Outbound host access must be grant-scoped by the caller's authorization, not declared as a static app allowlist.

**Deployment and operations**

- R14. The minimum hosted path must document Vercel for the UI and Render for the backend worker/API, with shared environment variables and secret handling.
- R15. The production path must document Cloud Run, managed Postgres, Secret Manager, and queue-backed contract work as the insurer-ready target.
- R16. Live proof documentation must separate public-safe evidence from secrets and must warn that keys pasted in chat or demos should be rotated.

---

## Key Flows

- F1. **Build and register contract**
  - **Trigger:** Developer prepares the live T3N proof.
  - **Actors:** A3
  - **Steps:** Build the Rust component, authenticate to T3N testnet, read the tenant DID from the session, register the WASM under a stable tail, and persist a public-safe registration summary.
  - **Outcome:** ClaimsPilot has a registered tenant contract that can be named as `z:<tid>:<tail>`.
  - **Covered by:** R1, R2, R3, R4, R6, R7, R8

- F2. **Invoke protected claim decision**
  - **Trigger:** ClaimsPilot evaluates a claim in live mode.
  - **Actors:** A1, A2, A3
  - **Steps:** Prepare sanitized claim and grant input, invoke the registered contract, decode the returned decision, and write an audit row that identifies the live contract proof.
  - **Outcome:** The protected decision comes from T3N and the app can display or record the proof without leaking secrets.
  - **Covered by:** R5, R9, R10, R11, R16

- F3. **Invoke placeholder outbound action**
  - **Trigger:** ClaimsPilot graduates from policy-only proof to insurer action proof.
  - **Actors:** A1, A4, A5
  - **Steps:** The caller grants the contract function and destination host, the contract templates placeholders into the outbound payload, and Terminal 3 resolves sensitive fields inside the TEE before the insurer call.
  - **Outcome:** The insurer action runs without raw PII entering agent context or contract input.
  - **Covered by:** R12, R13

---

## Acceptance Examples

- AE1. **Successful registration**
  - **Given:** `T3N_API_KEY` is configured for testnet and the contract WASM exists.
  - **When:** The registration script runs with a new semver version.
  - **Then:** It authenticates, reads the session tenant DID, registers the contract, and records a public-safe summary.

- AE2. **Version conflict**
  - **Given:** The same contract tail already has the requested version.
  - **When:** The registration script runs again.
  - **Then:** It reports the version conflict clearly and tells the developer to bump the contract version.

- AE3. **Approved live invoke**
  - **Given:** A claim is inside the grant amount, type, region, identity, and host policy.
  - **When:** ClaimsPilot invokes the T3N contract.
  - **Then:** The decoded result is approved and the audit proof marks the source as live T3N.

- AE4. **Escalated live invoke**
  - **Given:** A claim amount exceeds the current grant limit.
  - **When:** ClaimsPilot invokes the T3N contract.
  - **Then:** The decoded result requires escalation and the OpenAI planner cannot convert it into approval.

- AE5. **Outbound host denied**
  - **Given:** The placeholder outbound milestone is enabled without a caller grant for the insurer host.
  - **When:** The contract attempts the outbound call.
  - **Then:** The action fails with an egress authorization error rather than silently bypassing Terminal 3.

---

## Success Criteria

- A live `cargo build --target wasm32-wasip2 --release` artifact exists for `contracts/claims-policy`.
- A live registration script can register or clearly reject the current contract version on T3N testnet.
- A live invoke script can call the registered contract and print sanitized approved and escalated/denied proof outputs.
- The app can distinguish local demo policy decisions from live T3N contract decisions.
- `docs/LIVE-PROOF.md` can be updated with registration and invocation evidence without exposing API keys.
- The deployment recommendation clearly says Vercel+Render is the minimum hosted path and Cloud Run is the insurer-ready path.

---

## Scope Boundaries

### In Scope

- Add the WIT world and WASI component shape.
- Add live register and invoke scripts using the installed Terminal 3 SDK.
- Add app and documentation hooks that make the live contract proof visible.
- Preserve the existing local demo mode as a fallback for video recording.
- Document the minimum and production deployment paths.

### Deferred for Later

- Full multi-tenant insurer onboarding.
- Production KYC/profile enrollment flows.
- Real insurer API credentials and compliance procurement.
- Full Cloud Run Terraform and production monitoring implementation.
- Signed user grant UX beyond the minimum needed to prove the contract path.

### Outside This Product's Identity

- A full claims administration suite.
- A generic T3N contract registry product.
- A payment processor or policy administration system.

---

## Dependencies / Assumptions

- The active Terminal 3 testnet account remains admitted as a tenant and has enough test credits.
- `@terminal3/t3n-sdk` continues to expose `T3nClient`, `TenantClient`, `loadWasmComponent`, `setEnvironment`, `getNodeUrl`, `getScriptVersion`, and tenant contract methods.
- Rust tooling can install the `wasm32-wasip2` target locally.
- Placeholder outbound calls may need additional user-profile or grant setup beyond the current repo.
- Vercel+Render can host the minimum split runtime, but production posture should move to Cloud Run once the hack proof is stable.

---

## Sources / Research

- Terminal 3 ADK product page: https://www.terminal3.io/products/agent-developer-kit
- Terminal 3 ADK overview: https://docs.terminal3.io/developers/adk/overview/what-is-adk
- Terminal 3 setup guide: https://docs.terminal3.io/developers/adk/get-started/prerequisites/set-up-dev-env
- Terminal 3 write contract guide: https://docs.terminal3.io/developers/adk/get-started/walkthrough/write-contract
- Terminal 3 build contract guide: https://docs.terminal3.io/developers/adk/get-started/walkthrough/build-contract
- Terminal 3 register contract guide: https://docs.terminal3.io/developers/adk/get-started/walkthrough/register-contract
- Terminal 3 invoke contract guide: https://docs.terminal3.io/developers/adk/get-started/walkthrough/invoke-contract
- Terminal 3 common errors: https://docs.terminal3.io/developers/adk/tips/common-errors
- Terminal 3 sample contract: https://github.com/Terminal-3/z-tenant-flight
- Current ClaimsPilot SDK boundary: `docs/TERMINAL3-INTEGRATION.md`
- Current live proof gap: `docs/LIVE-PROOF.md`
