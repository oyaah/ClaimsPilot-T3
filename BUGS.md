# Terminal 3 Bug Bounty Ledger

Primary report:

- [TERMINAL3_CLAIMSPILOT_CONFIRMED_BUG_REPORT.md](./TERMINAL3_CLAIMSPILOT_CONFIRMED_BUG_REPORT.md)

This file is intentionally short. The detailed bug-bounty submission lives in the report above so the product pitch and the bug evidence stay separate.

All findings re-verified against live sources on 2026-06-14:
`@terminal3/t3n-sdk@3.5.2` (latest on npm), `z-tenant-flight@1226b39` (current `HEAD`), and live docs pages.

## Confirmed Findings

| ID | Severity | Area | Title |
| --- | --- | --- | --- |
| A1 | major | sample source vs docs | README teaches raw-PII `book-offer`; source forbids it and its own test rejects it |
| A2 | major | sample docs | README documents an obsolete `host_capabilities` manifest, missing `http-with-placeholders` |
| A3 | minor | sample docs | Three-way version drift: README `v0.3.0` / Cargo `0.4.1` / WIT `@0.4.0` |
| A4 | polish | sample docs vs source | README `book-offer` output omits the `awaiting_payment` status the source returns |
| B1 | major | ADK docs | `http-with-placeholders` quick-tip uses a stale binding/request shape |
| B2 | polish | onboarding docs | Setup page says "Quick 4 steps" but renders 5 |
| C1 | minor | SDK docs | SDK README uses `T3N_DEMO_KEY` while product/docs use `T3N_API_KEY` |
| C2 | minor | SDK docs | SDK README Quick Start hard-codes a non-existent `baseUrl` and omits `setEnvironment` |
| C3 | minor | SDK/framework | Next.js/Turbopack worker-thread module error unless the SDK is externalized |

Bug-track scope = onboarding bugs + documentation gaps. A1–C3 all sit in that scope.

## Beyond Scope (offered for completeness)

| ID | Severity | Area | Title |
| --- | --- | --- | --- |
| E1 | minor | SDK runtime | `SessionOrgDataClient` guard only catches no-handshake; auth-missing client slips through to opaque `RpcError` (documented behavior, not an onboarding/doc gap) |

## Investigated, Not Submitted

- One-time WASM path error: not reproducible on `3.5.0` / `3.5.2`, so excluded.
- `getUsage().balance.available` and `metamask_sign` signature: audited against `dist/index.d.ts`, correct — verified clean, not a bug.
- `session.core.wasm` crypto core (AES-GCM / ML-KEM-768 / ECDSA / SIWE): disassembled and audited — uses freshly generated nonces and time-bound SIWE checks. No hardcoded-nonce / replay bug. Stated to record the absence.
- `dist/index.js` is string-array **obfuscated**; no speculative reverse-engineered findings submitted from it.
