# Terminal 3 SDK / Docs Bug Ledger

This file is intentionally separate from the product pitch.

Only add findings that are:

- SDK, ADK, T3N, onboarding, or documentation related
- verified against current docs or package versions
- reproducible
- actionable
- not duplicates of prior Houdini or SpendPass reports

## Finding Template

```md
### BUG-XX - Short title

Severity:
Scope:
Versions:

Source:
- docs/source URL
- package/source URL

Steps to reproduce:
1.
2.
3.

Expected:

Actual:

Impact:

Workaround:

Suggested fix:

Duplicate check:
```

## Candidate Lanes To Verify

- SDK setup examples versus current TypeScript types.
- Contract walkthrough omissions around maps, grants, and host capabilities.
- `http-with-placeholders` docs versus generated WIT binding shapes.
- Allowed-host egress denial remediation.
- Test token/API key retrieval footguns.
- Runtime-required fields typed as optional.

## Verified Findings

### BUG-01 - T3N SDK quickstart omits WASM loading requirements for Next.js/Turbopack

Severity: Medium
Scope: SDK onboarding / framework integration
Versions: `@terminal3/t3n-sdk@3.5.0`, `next@16.2.7`, Turbopack dev server

Source:
- `node_modules/@terminal3/t3n-sdk/README.md`
- `node_modules/@terminal3/t3n-sdk/dist/index.d.ts`
- `docs/TERMINAL3-INTEGRATION.md`

Steps to reproduce:
1. Install `@terminal3/t3n-sdk@3.5.0` in a Next.js 16 App Router project.
2. Use the SDK README quickstart: `loadWasmComponent()` with no `wasmPath`.
3. Call the flow from a server-rendered route/page: `setEnvironment`, `eth_get_address`, `new T3nClient`, `handshake`, `authenticate`.
4. Open the page in `next dev`.

Expected:

The README quickstart should either work in common server frameworks or document the required framework configuration.

Actual:

Next/Turbopack surfaced: `The "path" argument must be of type string or an instance of URL. Received an instance of URL`.

Impact:

Builders can have valid sandbox credentials and correct SDK calls, but still think authentication is broken. This is a high-friction onboarding failure for bounty participants.

Workaround:

- Add `serverExternalPackages: ["@terminal3/t3n-sdk"]` in `next.config.ts`.
- Pass the shipped WASM file explicitly to `loadWasmComponent`.

Suggested fix:

Add a Next.js/Turbopack section to the SDK README and expose a framework-safe helper or documented asset path for `session.core.wasm`.

Duplicate check:

Not copied from the previous Houdini submission. Found while integrating ClaimsPilot live status.
