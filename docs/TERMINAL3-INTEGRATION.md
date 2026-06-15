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

## Real T3N Contract

`contracts/claims-policy` is now a real `wasm32-wasip2` WASM component, not a
skeleton. It exports `claimspilot:claims-policy/contracts@0.2.0` with:

- `evaluate-claim(generic-input) -> result<list<u8>, string>` — policy-only,
  no PII; input is the sanitized policy envelope.
- `submit-claim(generic-input) -> result<list<u8>, string>` — approved-claim
  outbound submit through `host:interfaces/http-with-placeholders@2.1.0`.

Build → register → invoke:

```bash
npm run t3:build-contract   # cargo build --target wasm32-wasip2 --release
npm run t3:register         # tenant.contracts.register({ tail, version, wasm })
npm run t3:invoke           # T3nClient.executeAndDecode({ script_name, script_version, function_name, input })
```

- Tenant DID is read from the authenticated session (`authenticate()` output),
  never derived from wallet material or hard-coded — see `lib/t3/contract.ts`.
- The tail is the tenant-local name `claims-policy`; the SDK canonicalizes it to
  `z:<tid>:claims-policy` via `canonicalTenantName`.
- `getScriptVersion(getNodeUrl(), scriptName)` resolves the registered version.
- The decoded decision is compared against `lib/domain/policy.ts` (the same logic
  the Rust contract mirrors); a mismatch is surfaced, never hidden.

The app selects the decision source at request time
(`lib/t3/decision-source.ts`): live T3N contract when not in demo mode, a key is
configured, and a registration exists; otherwise the deterministic local policy.
Every evaluation writes an audit row marking `live` / `demo` / `error` and, for
live, the script name + version proof. The OpenAI planner can change explanation
text only — it never feeds the protected decision.

## Placeholder Outbound (U6)

The PII-bearing insurer call is now wired as a separate submit step after live
approval:

- the WIT world imports `host:interfaces/http-with-placeholders@2.1.0`;
- `submit-claim` templates `{{profile.*}}` markers into the insurer payload and
  the host resolves them inside the TEE;
- outbound egress is authorized by the caller's grant (allowed-host), surfacing
  `host_not_allowed` / egress-denied instead of a silent direct HTTP call.

Set `CLAIMSPILOT_INSURER_BASE_URL` to a public deployment that exposes
`/api/mock-insurer/payouts`. Without a T3N user profile and allowed-host grant,
the expected live result is egress denial; with both, the host resolves profile
placeholders inside the TEE and the mock insurer returns a sanitized receipt.
