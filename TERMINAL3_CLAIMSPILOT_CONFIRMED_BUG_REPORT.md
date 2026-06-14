# Terminal 3 ADK / T3N — Confirmed Bug Report

**Submission for:** Terminal 3 Agent Developer Kit (ADK) bounty — bug-discovery track
**Project built while testing:** ClaimsPilot, an AI insurance-claims agent gated by Terminal 3 protected actions
**Reporter:** Yash Bansal / oyaah
**Test date:** 2026-06-14
**Method:** Built a live ClaimsPilot integration against `@terminal3/t3n-sdk`, then audited the official Terminal 3 docs, the official `z-tenant-flight` sample contract source, and the installed SDK package — and only kept findings I could reproduce from a primary source on the test date. The SDK audit went past the README: I read the full `dist/index.d.ts` type surface (3,189 lines), extracted and inspected the shipped `session.core.wasm`, and checked the bundled JS. Where that deeper audit found the implementation to be *sound*, I say so explicitly (see Section D) rather than inflating it into a finding.

Every finding below is verified from at least one of:

- official Terminal 3 documentation pages (fetched 2026-06-14)
- the official sample contract `Terminal-3/z-tenant-flight` **source** (not just its prose)
- the published `@terminal3/t3n-sdk@3.5.2` package (README, `dist/index.d.ts`)
- reproducible commands from the ClaimsPilot build

No SpendPass / prior-bounty finding is reused. That bounty audited the VC / Agent-Auth SDK; this is the ADK / T3N contract SDK — a different codebase. The *structure and discipline* here are inspired by that report (source-verified, severity-tiered, exact Expected/Actual, honest about what I could not confirm); the bugs are original.

## Severity Legend

- **blocker** — prevents a core ADK/SDK flow from working
- **major** — likely to push builders into an insecure or broken implementation
- **minor** — friction, wrong copy-paste defaults, avoidable debugging
- **polish** — low-risk docs/onboarding quality issue

## Verified Sources & Versions (all checked 2026-06-14)

**SDK package**

- `@terminal3/t3n-sdk@3.5.2` — confirmed `latest` on npm (`npm view @terminal3/t3n-sdk dist-tags` → `{ latest: '3.5.2' }`)

**Official sample contract**

- `Terminal-3/z-tenant-flight`, default branch `main`, commit `1226b396ac909379df0814308c5c9ea055e703f0` — confirmed to be the current `HEAD` (the latest commit, not a stale pin), pushed `2026-06-05`
- Files read: `README.md`, `src/booking.rs`, `wit/world.wit`, `Cargo.toml`

**Documentation pages**

- Setup dev env: `https://docs.terminal3.io/developers/adk/get-started/prerequisites/set-up-dev-env`
- Register contract: `https://docs.terminal3.io/developers/adk/get-started/walkthrough/register-contract`
- Write contract: `https://docs.terminal3.io/developers/adk/get-started/walkthrough/write-contract`
- Placeholders outbound calls: `https://docs.terminal3.io/developers/adk/tips/placeholders-outbound-calls`
- Outbound HTTP auth by user: `https://docs.terminal3.io/developers/adk/tips/outbound-http-auth-by-user`
- Capabilities from WIT import: `https://docs.terminal3.io/developers/adk/tips/capabilities-from-wit-import`
- Common errors: `https://docs.terminal3.io/developers/adk/tips/common-errors`
- Docs index: `https://docs.terminal3.io/llms.txt`

**ClaimsPilot test environment**

- `@terminal3/t3n-sdk`: `3.5.2`, `next`: `16.2.7`, T3 environment: `testnet`
- Live SDK status: authenticated session established (`client.authenticate(createEthAuthInput(address))` returned a `did:t3n:...`); `client.getUsage()` returned a `BalanceRow` with available credits. Secrets are intentionally excluded from this repo.

---

## A. Official Sample Contract (`z-tenant-flight`) Bugs

These are the most important findings. `z-tenant-flight` is the first contract a builder clones, and its README actively teaches the **opposite** of Terminal 3's core privacy guarantee. The contract *source* is current and correct; the *README* is stale and dangerous.

### A1 — README teaches passing raw passenger PII into the contract; the source forbids it (and its own tests reject it)

**Severity:** major
**Area:** official sample repository docs vs source
**Source:** `z-tenant-flight@1226b39` — `README.md`, `src/booking.rs`, `wit/world.wit`

**Expected:**
The sample should teach the current Terminal 3 privacy model: the agent does **not** send passenger PII into the contract; the contract templates `{{profile.*}}` markers; `http-with-placeholders` resolves them inside the TEE; plaintext PII never enters WASM memory.

**Actual:**
The source already implements exactly that. `src/booking.rs` opens with:

```rust
//! Passenger PII (name, DOB, passport, contact) is NEVER passed in as a
//! contract argument. The contract templates `{{profile.<field>}}` markers
//! into the Duffel order body ... so plaintext PII never enters WASM memory.
```

`BookOfferReq` carries only non-PII fields:

```rust
pub struct BookOfferReq {
    pub offer_id: String,
    pub passenger_id: String,   // opaque Duffel slot id, NOT PII
    pub total_amount: String,
    pub total_currency: String,
}
```

`wit/world.wit` agrees: `book-offer` "Carries NO passenger PII".

The **README contradicts all of this**. It says:

- (table) `book-offer` → "POST to Duffel `/air/orders` with **full passenger PII**"
- (privacy guarantee) "passenger PII (passport number, date-of-birth, full name, email, phone) **is passed in by the agent**"
- the `book-offer` input example shows a `passengers: [{ given_name, family_name, date_of_birth, passport_number, nationality, passport_expiry, gender, email, phone }]` array
- the architecture diagram annotates `book-offer` with "PII enters T3 Network here"

The decisive proof: the contract's **own unit test** asserts the README's documented input shape is rejected:

```rust
#[test]
fn book_offer_rejects_inline_pii_fields() {
    let input = serde_json::to_vec(&serde_json::json!({
        "offer_id": "off_abc123",
        "passengers": [{ "given_name": "Jane" }],   // the README's shape
        "total_amount": "199.00",
        "total_currency": "GBP",
    })).unwrap();
    let result = book_offer(&input);
    assert!(result.is_err());                        // README example -> error
    assert!(result.unwrap_err().contains("bad input"));
}
```

So a builder who copies the README's `book-offer` payload hits `book-offer: bad input` — and the repo's test suite proves it.

**Reproduction:**

```bash
gh repo clone Terminal-3/z-tenant-flight
cd z-tenant-flight
grep -n "full passenger PII\|is passed in by the agent\|PII enters" README.md
sed -n '1,17p'   src/booking.rs          # "NEVER passed in as a contract argument"
grep -n "book_offer_rejects_inline_pii_fields" src/booking.rs
grep -n "Carries NO passenger PII"        wit/world.wit
```

**Impact:**
This cuts straight against Terminal 3's value proposition. A builder following the README designs the agent to carry raw passport/DOB/contact PII into the contract payload (and therefore into agent/prompt context) — the exact leak ADK exists to prevent. For a bounty, this is not cosmetic: it changes the architecture and whether a build is judged privacy-preserving.

**Workaround:**
Treat `src/booking.rs` + `wit/world.wit` as the source of truth; ignore the README's `book-offer` PII shape.

**Suggested fix:**
Rewrite the README `book-offer` section to: input = `{ offer_id, passenger_id, total_amount, total_currency }`; privacy guarantee = "PII is resolved host-side via `http-with-placeholders`, never passed by the agent"; diagram note = "PII is resolved inside the TEE, never received from the agent."

---

### A2 — README documents an obsolete `host_capabilities` manifest, missing `http-with-placeholders`

**Severity:** major
**Area:** official sample repository docs / contract onboarding
**Source:** `z-tenant-flight@1226b39` — `README.md`, `wit/world.wit`; docs `register-contract`, `capabilities-from-wit-import`

**Expected:**
Per current docs, a contract's capabilities come from its **WIT imports**; the registration payload is just `{ tail, version, wasm }` with no manifest. The register-contract page states verbatim: "Your contract's capabilities come from the host interfaces it imports in `world.wit`, not from this registration request" and "The register payload is just `{ tail, version, wasm }`; there is no manifest."

**Actual:**
`wit/world.wit` imports five host interfaces, including the privacy-critical one:

```wit
import host:tenant/tenant-context@1.0.0;
import host:interfaces/logging@2.1.0;
import host:interfaces/kv-store@2.1.0;
import host:interfaces/http@2.1.0;                    // search (no PII)
import host:interfaces/http-with-placeholders@2.1.0;  // booking (PII via placeholders)
```

But the README still instructs builders to declare a manifest:

```json
{ "host_capabilities": ["kv_store", "logging", "tenant_context", "http"] }
```

That manifest concept is stale relative to the current docs, **and** it omits `http-with-placeholders` — the one capability the booking path depends on.

**Reproduction:**

```bash
grep -n "host_capabilities" z-tenant-flight/README.md
grep -n "http-with-placeholders" z-tenant-flight/wit/world.wit
# compare with docs.terminal3.io/.../register-contract and .../tips/capabilities-from-wit-import
```

**Impact:**
Builders hunt for a manifest mechanism the current flow doesn't use, and may omit `http-with-placeholders` from their mental model while implementing the privacy-safe last mile.

**Suggested fix:**
Delete the manifest section; replace with a short "capabilities come from your `world.wit` imports" note linking the capabilities-from-WIT doc.

---

### A3 — Three-way version drift across README, `Cargo.toml`, and `world.wit`

**Severity:** minor
**Area:** official sample repository docs
**Source:** `z-tenant-flight@1226b39`

**Expected:**
The sample's version should be consistent across its surfaces.

**Actual:**
Three different versions are shipped simultaneously:

- `README.md` line 3: "Duffel flight booking showcase for Trinity z-namespace tenants — **v0.3.0**."
- `Cargo.toml`: `version = "0.4.1"`
- `wit/world.wit`: `package z:tenant-flight@0.4.0;`

**Reproduction:**

```bash
sed -n '3p' z-tenant-flight/README.md
grep -n '^version' z-tenant-flight/Cargo.toml
grep -n 'package z:tenant-flight' z-tenant-flight/wit/world.wit
```

**Impact:**
Low risk, but the README header is two minor versions behind the crate, which is a strong "this README is stale" signal — and indeed the README is exactly where A1/A2 live. Version registration in T3N is version-sensitive (the docs' "version is not higher than current version" error), so loose version copy in the canonical sample is worth tightening.

**Suggested fix:**
Drive the README version from `Cargo.toml`, and align the WIT package version in the same bump.

---

### A4 — README `book-offer` output example doesn't match the status the source returns

**Severity:** polish
**Area:** official sample repository docs vs source
**Source:** `z-tenant-flight@1226b39` — `README.md`, `src/booking.rs`

**Expected:**
The documented return example should match what the contract can actually return.

**Actual:**
README shows `book-offer` returning `{ "id": "ord_...", "pnr": "ABC123", "status": "confirmed" }`. The source derives `status` from Duffel's `payment_status.awaiting_payment`:

```rust
let status = order["data"]["payment_status"]["awaiting_payment"]
    .as_bool()
    .map(|b| if b { "awaiting_payment" } else { "confirmed" })
    ...
```

So `status` is `"awaiting_payment"` or `"confirmed"` — the README only shows the happy value, with no mention of `awaiting_payment`.

**Impact:**
A builder hard-coding against `"confirmed"` will mishandle the `awaiting_payment` case the contract really emits.

**Suggested fix:**
Document both `status` values in the README example.

---

## B. ADK Documentation Bugs

### B1 — `http-with-placeholders` quick-tip uses a stale binding/request shape (the one snippet builders copy is the wrong one)

**Severity:** major
**Area:** ADK docs / Rust contract copy-paste path
**Source:** docs `placeholders-outbound-calls`, `write-contract`, `outbound-http-auth-by-user`; `z-tenant-flight/src/booking.rs`

**Expected:**
The placeholders quick-tip — the page a builder lands on to implement the flagship privacy feature — should use the same binding shape as the generated bindings, the walkthrough, and the sample source.

**Actual:**
The quick-tip snippet diverges from the real generated bindings on four axes:

| | placeholders quick-tip (docs) | sample source `booking.rs` (real binding) |
|---|---|---|
| import path | `crate::bindings::t3n::host::http_with_placeholders` | `crate::host::interfaces::http_with_placeholders as hwp` |
| HTTP method | `"POST".to_string()` (string) | `hwp::Verb::Post` (enum) |
| payload field | `body` | `payload` |
| headers | plain `vec![...]` | `Some(...)` |

The real call (`src/booking.rs`):

```rust
use crate::host::interfaces::http_with_placeholders as hwp;
let resp = hwp::call(&hwp::Request {
    method:  hwp::Verb::Post,
    url:     format!("{DUFFEL_BASE}/air/orders"),
    headers: Some(duffel_headers(&api_key)),
    payload: Some(serde_json::to_vec(&order_body)?),
})?;
```

Compounding it: the sibling `outbound-http-auth-by-user` page (which explains *why* egress can fail) shows **no** Rust snippet at all — so the single copy-pasteable placeholder snippet in the docs is the stale one.

**Reproduction:**
Open `https://docs.terminal3.io/developers/adk/tips/placeholders-outbound-calls` and diff its Rust block against:

```bash
sed -n '48,107p' z-tenant-flight/src/booking.rs
```

**Impact:**
This is the exact page a builder reaches for the privacy-preserving feature. Copying it sends them down a wrong import path with a non-existent request shape — `body` doesn't exist (`payload` does), `"POST".to_string()` won't type-check against `Verb`, and the import path won't resolve — which is painful for anyone not already fluent in `wit-bindgen` output.

**Suggested fix:**
Replace the quick-tip code with the generated-binding shape above (`use ... host::interfaces::http_with_placeholders as hwp; method: hwp::Verb::Post; headers: Some(..); payload: Some(..)`), and name the host-interface version (`@2.1.0`).

---

### B2 — Setup page says "Quick 4 steps" but renders 5 steps

**Severity:** polish
**Area:** ADK onboarding docs
**Source:** docs `set-up-dev-env`

**Expected:**
Title and step count should match.

**Actual:**
Subtitle: "Quick 4 steps to set up your development environment." The page then renders five numbered steps:

1. Get your API key and DID
2. Install Rust + WASM toolchain
3. Install the SDK
4. Set up the SDK
5. Authenticate to T3N testnet

(For what it's worth, this page correctly uses `T3N_API_KEY` — see C1.)

**Impact:**
Low risk, but a brand-new setup guide that miscounts its own steps reads as stale and prompts a "did I miss a page?" moment.

**Suggested fix:**
Say "Quick 5 steps", or merge authentication into step 4.

---

## C. SDK Package (`@terminal3/t3n-sdk@3.5.2`) & Onboarding Bugs

### C1 — SDK README uses `T3N_DEMO_KEY`; the product page and docs use `T3N_API_KEY`

**Severity:** minor
**Area:** SDK onboarding docs
**Source:** `@terminal3/t3n-sdk@3.5.2/README.md`; docs `set-up-dev-env`

**Expected:**
One env-var name for the same credential across onboarding surfaces.

**Actual:**
The setup docs use `T3N_API_KEY` (`const T3N_API_KEY = process.env.T3N_API_KEY!`). The installed SDK README quickstart uses a different name:

```typescript
const privateKey = process.env.T3N_DEMO_KEY!;
```

**Reproduction:**

```bash
npm pack @terminal3/t3n-sdk@3.5.2 && tar -xzf terminal3-t3n-sdk-3.5.2.tgz
grep -n "T3N_DEMO_KEY\|T3N_API_KEY" package/README.md
```

**Impact:**
A builder who sets `T3N_API_KEY` from the docs, then pastes the SDK README quickstart, silently gets `undefined` until they notice the rename.

**Suggested fix:**
Use `T3N_API_KEY` in the SDK README, or document the alias explicitly.

---

### C2 — SDK README "Quick Start" hard-codes a non-existent node URL and omits `setEnvironment`

**Severity:** minor
**Area:** SDK onboarding docs
**Source:** `@terminal3/t3n-sdk@3.5.2/README.md`

**Expected:**
The very first runnable example should reach a real node — either by calling `setEnvironment("testnet")` (as the README's own "Environments" section instructs) or by pointing `baseUrl` at a real node.

**Actual:**
The Quick Start hard-codes a placeholder host and never selects an environment:

```typescript
const client = new T3nClient({
  baseUrl: "https://t3n-node.example.com",   // non-existent host
  wasmComponent,
  handlers: { EthSign: metamask_sign(address, undefined, privateKey) },
});
await client.handshake();
```

The Quick Start import list also omits `setEnvironment`, and the README later states `baseUrl` *takes precedence over* the environment default — so this example targets `t3n-node.example.com` regardless of any later `setEnvironment` call. The second ("Ethereum Authentication") example has the opposite problem: no `baseUrl` **and** no `setEnvironment`, leaving the target node to an undocumented default.

**Reproduction:**

```bash
sed -n '20,76p' package/README.md   # baseUrl: "https://t3n-node.example.com"; no setEnvironment
```

**Impact:**
Copy-pasting the first example produces a handshake against a dead host. Because `baseUrl` overrides the environment, a builder who later "fixes" it by adding `setEnvironment("testnet")` still fails until they also delete the `baseUrl` line — a non-obvious precedence trap during first integration.

**Suggested fix:**
Make the Quick Start call `setEnvironment("testnet")` and drop the hard-coded `baseUrl` (or use a clearly-fake constant with a comment: "replace with your node, or remove and use `setEnvironment`"). Add `setEnvironment` to the example imports.

---

### C3 — Next.js / Turbopack server usage can emit an uncaught worker-thread module error unless the SDK is externalized

**Severity:** minor
**Area:** SDK / framework integration docs
**Source:** ClaimsPilot repro, `@terminal3/t3n-sdk@3.5.2`, `next@16.2.7`

**Expected:**
The SDK should run cleanly in common server frameworks, or document the required config.

**Actual:**
In a Next.js 16 / Turbopack App Router server route with `serverExternalPackages` removed and `loadWasmComponent()` at defaults, the T3 status route still authenticated, but the dev server emitted:

```text
Warning: Failed to load the ES module: .../.next/dev/server/assets/worker-thread...
uncaughtException: SyntaxError: Cannot use import statement outside a module
```

Adding the SDK to `serverExternalPackages` removed it.

**Reproduction:**
Call the documented `handshake()` / `authenticate()` flow from a Next.js App Router server route with no `serverExternalPackages`, run `npm run dev`, and hit the route.

**Honesty note:** this is an environment/framework interaction, not a defect in SDK logic, and severity is kept low accordingly. Authentication itself succeeded throughout.

**Workaround / suggested fix:**

```ts
// next.config.ts
const nextConfig = { serverExternalPackages: ["@terminal3/t3n-sdk"] };
```

Add a short "Using the SDK in Next.js / server frameworks" note to the SDK README (externalize the package, optional explicit `wasmPath`, supported Node versions).

---

### C4 — `SessionOrgDataClient`'s runtime guard only catches the no-handshake case, giving false confidence

**Severity:** minor
**Area:** SDK API surface / runtime validation
**Source:** `@terminal3/t3n-sdk@3.5.2/dist/index.d.ts`

**Expected:**
A client that accepts a caller-owned, pre-authenticated `T3nClient` should either verify the client is actually authenticated, or its guard should not imply it does.

**Actual:**
`SessionOrgDataClient` takes a caller-driven `T3nClient` and runs a per-method runtime guard — but, per the SDK's own type docs, the guard only checks for the *no-handshake* case and silently lets a half-initialized (handshook-but-not-authenticated) client through:

```text
The runtime guard only catches the no-handshake case
(`t3n.getSessionId()` returns `null`); a client that has handshaken but
not authenticated will pass the guard and instead fail later with an
`RpcError` from `action.execute`.
```

`getSessionId()` is set by `handshake()`, not by `authenticate()` — so a client that handshook but never authenticated has a non-null session id and slips past the guard, only to fail downstream with an opaque RPC error.

**Reproduction:**

```bash
grep -n "runtime guard only catches the no-handshake" package/dist/index.d.ts
# context: the SessionOrgDataClient class + constructor JSDoc (~lines 2659-2698)
```

**Impact:**
A partial guard is worse than none — it signals "this is checked" while admitting the most common real mistake (forgetting `authenticate()`), and the resulting failure surfaces far from the cause as a generic `RpcError`. This is the same class of "validation too permissive" issue that bites builders during first integration.

**Suggested fix:**
Either gate methods on an authenticated-session check (not merely a non-null session id), or rename/redocument the guard so it doesn't imply auth verification. Surfacing a typed `NotAuthenticated` error at call time would remove the downstream-`RpcError` confusion.

---

## D. Investigated But Not Submitted (kept out on purpose)

Honesty about what I could **not** confirm is part of the method.

- **One-time WASM path error.** Early in the ClaimsPilot build I once saw `The "path" argument must be of type string or an instance of URL. Received an instance of URL`. Clean repros on `3.5.0` and `3.5.2` authenticated without an explicit `wasmPath`, so I could not reproduce it and am not submitting it.
- **Integration vs. type contract — verified clean, not a bug.** I checked ClaimsPilot's reliance on `getUsage().balance.available` against `dist/index.d.ts`: `UsagePage.balance` is a `BalanceRow` and `BalanceRow.available: number` exists, so the integration is correct. Likewise `metamask_sign(account: EthAccount, ...)` accepts `EthAccount = string | {...}`, so passing the derived address string is valid.
- **Session-WASM crypto core — audited, found sound, not a bug.** I disassembled `dist/wasm/generated/session.core.wasm` (`strings` + symbol inspection). The handshake/auth state machine uses AES-GCM, ML-KEM-768, K256/ECDSA, and SIWE (EIP-4361) with **server-generated nonces** (`"RNG error: failed to generate nonce"`) and time-bound SIWE checks (`"SIWE lifetime exceeds server maximum (15 minutes)"`, `IssuedAtInFuture`, `ExpirationBeforeIssuedAt`, `NotYetValid`). I specifically looked for a hardcoded/constant nonce or a replay gap and found none — the nonce is freshly generated, so there is no nonce-reuse bug to report here. Stated plainly so the absence is on the record.
- **Bundled JS is obfuscated.** `dist/index.js` ships with string-array obfuscation, which makes high-confidence logic-bug extraction from the wrapper impractical. I am not submitting speculative reverse-engineered findings from it; the confirmed wrapper-level issues (C1–C4) come from the README and the readable `.d.ts`.

---

## Suggested Fix Priority

1. **A1** — Rewrite the sample README's `book-offer` PII model. Highest impact: it can lead builders to expose PII to the agent, the exact thing ADK prevents.
2. **B1** — Fix the placeholder quick-tip binding/request shape. Most likely copy-paste failure on the flagship feature.
3. **A2** — Remove the obsolete `host_capabilities` manifest from the sample README.
4. **C1 / C2** — Standardize `T3N_API_KEY` and fix the SDK README Quick Start node target.
5. **A3 / A4** — Align sample versions and the `book-offer` output example.
6. **C4** — Make `SessionOrgDataClient`'s guard check authentication, not just handshake.
7. **C3** — Add a Next.js note to the SDK README.
8. **B2** — Fix the setup-page step count.

## Why This Matters For Terminal 3

ADK is strongest when a builder internalizes one idea:

> The agent may reason, but private data and final authority stay behind identity, grants, TEE host capabilities, and audit.

The platform's docs and SDK *types* mostly hold that line — I verified the SDK type surface and it matched a working integration. The dangerous gaps are concentrated in the **first artifact a developer clones** (`z-tenant-flight`'s README) and the **one snippet they copy** for placeholders — and both currently teach the pre-privacy mental model the rest of the stack was built to retire.
