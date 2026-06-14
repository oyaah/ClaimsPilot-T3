# Terminal 3 Integration

ClaimsPilot follows the official ADK framing: identity plus protected outbound actions.

## SDK Flow

The adapter in `lib/t3/client.ts` follows the documented setup:

1. `setEnvironment("testnet")`
2. derive wallet address from `T3N_API_KEY`
3. load the WASM component
4. create `T3nClient`
5. sign with `metamask_sign`
6. `handshake`
7. `authenticate(createEthAuthInput(address))`
8. `getUsage`

The UI never claims live mode unless this flow succeeds.

For Next.js 16/Turbopack, the SDK must be treated as a server external package and the
shipped WASM file must be passed explicitly:

- `next.config.ts`: `serverExternalPackages: ["@terminal3/t3n-sdk"]`
- `loadWasmComponent({ wasmPath: "node_modules/@terminal3/t3n-sdk/dist/wasm/generated/session.core.wasm" })`

Without that, the SDK can throw a Node URL/path error while loading WASM even though the
same SDK flow works in a plain Node runtime.

## Protected Claims Action

The protected action is modeled as:

```text
agent recommendation -> app invocation -> claims policy contract -> placeholder outbound call -> sanitized result -> audit row
```

## Placeholder PII

The contract and app model sensitive fields as profile placeholders:

- `{{profile.first_name}}`
- `{{profile.last_name}}`
- `{{profile.date_of_birth}}`
- `{{profile.verified_contacts.email.value}}`

In a live T3N contract, `http-with-placeholders` resolves these inside the enclave just before the outbound insurer call.

## Allowed Host Grant

The demo grant includes `mock-insurer.local`. Removing that host should deny the outbound action with `host_not_allowed`, matching the Terminal 3 docs that outbound HTTP is authorized by the calling user's grant.

## Current Boundary

Implemented now:

- SDK adapter
- live DID/token status surface
- grant/policy/audit demo
- Rust policy kernel
- mock insurer API

Live contract work remaining:

- generated WIT bindings
- T3N contract publish/register script wired to the real SDK control path
- real `http-with-placeholders` invocation against a deployed endpoint
- full hosted deployment capture
