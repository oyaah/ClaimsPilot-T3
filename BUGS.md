# Terminal 3 Bug Bounty Ledger

Primary report:

- [TERMINAL3_CLAIMSPILOT_CONFIRMED_BUG_REPORT.md](./TERMINAL3_CLAIMSPILOT_CONFIRMED_BUG_REPORT.md)

This file is intentionally short. The detailed bug-bounty submission lives in the report above so the product pitch and the bug evidence stay separate.

## Current Confirmed Findings

| ID | Severity | Area | Title |
| --- | --- | --- | --- |
| CBUG-01 | major | sample docs | `z-tenant-flight` README contradicts current placeholder-based PII implementation |
| CBUG-02 | major | sample docs | `z-tenant-flight` README documents an obsolete host-capability manifest |
| CBUG-03 | major | ADK docs | `http-with-placeholders` docs use a stale request/binding shape |
| CBUG-04 | minor | SDK/docs | SDK README uses `T3N_DEMO_KEY` while product/docs use `T3N_API_KEY` |
| CBUG-05 | polish | onboarding docs | Setup page says "Quick 4 steps" but contains 5 steps |
| CBUG-06 | minor | SDK/framework docs | Next.js/Turbopack server integration can emit SDK worker-thread module errors unless the SDK is externalized |

## Not Submitted As Confirmed

- During early ClaimsPilot integration, a low-level WASM loader error was seen once in Next dev. Clean repros against `@terminal3/t3n-sdk@3.5.0` and `3.5.2` authenticated successfully, so that exact error is not submitted as a confirmed current bug.
