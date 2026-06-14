# Terminal 3 ADK / T3N Confirmed Bug Report

**Submission for:** Terminal 3 Agent Developer Kit Bounty - bug discovery track  
**Project built while testing:** ClaimsPilot, an AI insurance-claims agent with Terminal 3 protected-action gates  
**Reporter:** Yash Bansal / oyaah  
**Test date:** 2026-06-14  
**Method:** Built a live ClaimsPilot integration, authenticated to T3N testnet, wired a live OpenAI agent planner, then audited the official Terminal 3 website, Terminal 3 docs, official sample repository, and installed SDK package.  

This report only includes findings verified from one or more of:

- official Terminal 3 website pages
- official Terminal 3 documentation pages
- official Terminal 3 sample repository source
- installed `@terminal3/t3n-sdk` package files
- live/reproducible local commands from ClaimsPilot integration

The structure is inspired by the previous SpendPass report, but the findings below are original to this build. No SpendPass bug is copied.

## Severity Legend

- **blocker** - prevents a core SDK/ADK flow from working
- **major** - likely to mislead builders into insecure or broken implementations
- **minor** - causes friction, wrong copy/paste defaults, or avoidable debugging
- **polish** - low-risk docs/onboarding quality issue

## Verified Versions And Sources

### ClaimsPilot test environment

- `node`: `v25.9.0`
- `npm`: `11.12.1`
- `next`: `16.2.7`
- `@terminal3/t3n-sdk`: `3.5.2`
- T3 environment: `testnet`
- Live SDK status: authenticated session established
- Live agent planner: OpenAI `gpt-4.1-mini`

### Official sources checked

- Terminal 3 ADK product page: `https://www.terminal3.io/products/agent-developer-kit`
- Terminal 3 docs index: `https://docs.terminal3.io/llms.txt`
- About T3 docs: `https://docs.terminal3.io/intro/about-t3`
- ADK overview: `https://docs.terminal3.io/developers/adk/overview/what-is-adk`
- Setup dev env: `https://docs.terminal3.io/developers/adk/get-started/prerequisites/set-up-dev-env`
- Write contract walkthrough: `https://docs.terminal3.io/developers/adk/get-started/walkthrough/write-contract`
- Build contract walkthrough: `https://docs.terminal3.io/developers/adk/get-started/walkthrough/build-contract`
- Register contract walkthrough: `https://docs.terminal3.io/developers/adk/get-started/walkthrough/register-contract`
- Invoke contract walkthrough: `https://docs.terminal3.io/developers/adk/get-started/walkthrough/invoke-contract`
- Host API: `https://docs.terminal3.io/t3n/how-t3n-works/host-api`
- Capabilities from WIT tip: `https://docs.terminal3.io/developers/adk/tips/capabilities-from-wit-import`
- Outbound HTTP auth tip: `https://docs.terminal3.io/developers/adk/tips/outbound-http-auth-by-user`
- Placeholder outbound calls tip: `https://docs.terminal3.io/developers/adk/tips/placeholders-outbound-calls`
- Common errors: `https://docs.terminal3.io/developers/adk/tips/common-errors`
- Official sample repo: `https://github.com/Terminal-3/z-tenant-flight`
- Sample repo commit checked: `1226b396ac909379df0814308c5c9ea055e703f0`

## Live ClaimsPilot Verification

Before writing the report, ClaimsPilot was verified live:

```bash
npm run verify
npm test
npm run lint
npm run typecheck
npm run build
```

Live checks:

- `/dashboard/agent` showed live OpenAI planner output.
- `/dashboard/t3-status` showed T3N `LIVE`.
- `client.authenticate(createEthAuthInput(address))` returned the expected `did:t3n:...`.
- `client.getUsage()` returned a balance with available credits.

Secrets are intentionally excluded from this repo and report.

---

## A. Confirmed Terminal 3 ADK / Documentation Bugs

### CBUG-01 - `z-tenant-flight` README contradicts current placeholder-based PII implementation

**Severity:** major  
**Area:** official sample repository docs  
**Source:** `Terminal-3/z-tenant-flight` at commit `1226b396ac909379df0814308c5c9ea055e703f0`  

**Where verified:**

- `README.md`
- `src/booking.rs`
- `wit/world.wit`
- `Cargo.toml`
- Terminal 3 docs: `write-contract`, `placeholders-outbound-calls`, `host-api`

**Expected:**

The official sample README should teach the current Terminal 3 privacy model:

- the agent does not send full passenger PII into the contract
- the contract templates `{{profile.*}}` markers
- `http-with-placeholders` resolves the markers inside the enclave
- plaintext PII never enters WASM memory

**Actual:**

The sample source and WIT are current, but the README still teaches the older/insecure mental model.

The source says `BookOfferReq` only takes:

- `offer_id`
- `passenger_id`
- `total_amount`
- `total_currency`

The source templates placeholders such as:

- `{{profile.first_name}}`
- `{{profile.last_name}}`
- `{{profile.date_of_birth}}`
- `{{profile.verified_contacts.email.value}}`

The WIT also states that `book-offer` carries no passenger PII and uses the `generic-input` envelope.

The README, however, still says the agent passes passenger PII into the contract and shows `book-offer` input containing fields like:

- full name
- date of birth
- passport number
- nationality
- email
- phone

**Reproduction:**

```bash
gh api repos/Terminal-3/z-tenant-flight/contents/README.md --jq .content | base64 --decode | sed -n '1,140p'
gh api repos/Terminal-3/z-tenant-flight/contents/src/booking.rs --jq .content | base64 --decode | sed -n '1,180p'
gh api repos/Terminal-3/z-tenant-flight/contents/wit/world.wit --jq .content | base64 --decode | sed -n '1,120p'
```

**Impact:**

This cuts directly against Terminal 3's value proposition. A builder following the README can build a demo where the agent prompt/context carries raw PII, while the current ADK docs and implementation are designed to avoid exactly that.

For a bounty participant, this is not cosmetic. It affects architecture, demo narrative, and whether the solution is judged as privacy-preserving.

**Workaround:**

Ignore the sample README for `book-offer`; follow `src/booking.rs`, `wit/world.wit`, and the Terminal 3 placeholder docs instead.

**Suggested fix:**

Update `z-tenant-flight/README.md` so:

- version matches `Cargo.toml`
- `book-offer` input uses `offer_id`, `passenger_id`, `total_amount`, `total_currency`
- architecture diagram says PII is resolved through `http-with-placeholders`
- privacy guarantee says plaintext PII never enters WASM

---

### CBUG-02 - `z-tenant-flight` README documents an obsolete host-capability manifest

**Severity:** major  
**Area:** official sample repository docs / contract onboarding  
**Source:** `Terminal-3/z-tenant-flight` at commit `1226b396ac909379df0814308c5c9ea055e703f0`  

**Where verified:**

- `README.md`
- `wit/world.wit`
- `docs.terminal3.io/developers/adk/tips/capabilities-from-wit-import`
- `docs.terminal3.io/developers/adk/get-started/walkthrough/register-contract`
- `docs.terminal3.io/t3n/how-t3n-works/host-api`

**Expected:**

The sample README should match the current ADK model:

- capabilities come from WIT imports
- there is no separate manifest in the contract registration request
- `http-with-placeholders` must be represented as an imported host interface when booking uses placeholders

**Actual:**

The current sample WIT imports:

- `host:tenant/tenant-context@1.0.0`
- `host:interfaces/logging@2.1.0`
- `host:interfaces/kv-store@2.1.0`
- `host:interfaces/http@2.1.0`
- `host:interfaces/http-with-placeholders@2.1.0`

The current ADK registration docs say the register payload is only `{ tail, version, wasm }` and that capabilities come from imported host interfaces, not a manifest.

The sample README still instructs builders to declare:

```json
{ "host_capabilities": ["kv_store", "logging", "tenant_context", "http"] }
```

That manifest is missing `http-with-placeholders`, and the manifest concept itself is stale relative to the current docs.

**Reproduction:**

```bash
gh api repos/Terminal-3/z-tenant-flight/contents/README.md --jq .content | base64 --decode | sed -n '18,28p'
gh api repos/Terminal-3/z-tenant-flight/contents/wit/world.wit --jq .content | base64 --decode | sed -n '21,28p'
```

Then compare with:

- `https://docs.terminal3.io/developers/adk/get-started/walkthrough/register-contract`
- `https://docs.terminal3.io/developers/adk/tips/capabilities-from-wit-import`

**Impact:**

Builders can waste time looking for a manifest mechanism that the current flow does not use, or omit `http-with-placeholders` from their mental model while trying to implement privacy-safe last-mile calls.

**Workaround:**

Follow `wit/world.wit` and registration docs, not the sample README manifest section.

**Suggested fix:**

Delete the manifest section from the sample README and replace it with a WIT import explanation that links to the "Capabilities from WIT" doc.

---

### CBUG-03 - `http-with-placeholders` docs use a stale request/binding shape

**Severity:** major  
**Area:** ADK docs / Rust contract copy-paste path  
**Source:** Terminal 3 docs  

**Where verified:**

- `https://docs.terminal3.io/developers/adk/tips/placeholders-outbound-calls`
- `https://docs.terminal3.io/developers/adk/get-started/walkthrough/write-contract`
- `Terminal-3/z-tenant-flight/src/booking.rs`

**Expected:**

The quick-tip page for placeholders should use the same binding shape as the walkthrough and the official sample source.

**Actual:**

The placeholder quick-tip page shows a Rust import path and request shape that does not match the walkthrough/sample.

Placeholder quick-tip shape:

- imports `crate::bindings::t3n::host::http_with_placeholders`
- uses string method values such as `"POST".to_string()`
- uses a `body` field
- passes headers as a plain vector

Walkthrough and sample source shape:

- imports from `crate::host::interfaces::http_with_placeholders`
- uses `hwp::Verb::Post`
- uses `payload`
- wraps headers in `Some(...)`

**Reproduction:**

```bash
curl -L -s https://r.jina.ai/http://r.jina.ai/http://docs.terminal3.io/developers/adk/tips/placeholders-outbound-calls | sed -n '1,180p'
curl -L -s https://r.jina.ai/http://r.jina.ai/http://docs.terminal3.io/developers/adk/get-started/walkthrough/write-contract | sed -n '120,240p'
gh api repos/Terminal-3/z-tenant-flight/contents/src/booking.rs --jq .content | base64 --decode | sed -n '48,112p'
```

**Impact:**

This is the exact page a builder reaches when implementing the key privacy-preserving feature. Copying the quick-tip snippet can send them down the wrong binding/API path, especially if they are not already comfortable with `wit-bindgen` output.

**Workaround:**

Use the `write-contract` walkthrough and `z-tenant-flight/src/booking.rs` as the source of truth for current bindings.

**Suggested fix:**

Update the placeholder quick-tip code to match the current generated binding shape:

- `use crate::host::interfaces::http_with_placeholders as hwp;`
- `method: hwp::Verb::Post`
- `headers: Some(...)`
- `payload: Some(...)`

Add a note naming the host interface version used by the snippet.

---

### CBUG-04 - SDK README uses `T3N_DEMO_KEY` while product page and docs use `T3N_API_KEY`

**Severity:** minor  
**Area:** SDK onboarding docs  
**Source:** installed `@terminal3/t3n-sdk@3.5.2`, Terminal 3 product page, Terminal 3 setup docs  

**Expected:**

The official onboarding surfaces should use one environment variable name for the same credential.

**Actual:**

The Terminal 3 product page and setup docs instruct developers to use:

```bash
T3N_API_KEY
```

The installed SDK README quickstart uses:

```bash
T3N_DEMO_KEY
```

**Reproduction:**

```bash
sed -n '20,60p' node_modules/@terminal3/t3n-sdk/README.md
curl -L -s https://r.jina.ai/http://r.jina.ai/http://www.terminal3.io/products/agent-developer-kit | rg -n "T3N_API_KEY|T3N_DEMO_KEY"
curl -L -s https://r.jina.ai/http://r.jina.ai/http://docs.terminal3.io/developers/adk/get-started/prerequisites/set-up-dev-env | rg -n "T3N_API_KEY|T3N_DEMO_KEY"
```

**Impact:**

This is small but real onboarding friction. Builders who copy from the website into `.env.local`, then copy the SDK README code, get `undefined` unless they manually notice and rename the variable.

**Workaround:**

Use `T3N_API_KEY` consistently in app code and env examples.

**Suggested fix:**

Change the SDK README quickstart from `T3N_DEMO_KEY` to `T3N_API_KEY`, or explicitly document the alias.

---

### CBUG-05 - Setup page says "Quick 4 steps" but contains 5 steps

**Severity:** polish  
**Area:** ADK onboarding docs  
**Source:** `https://docs.terminal3.io/developers/adk/get-started/prerequisites/set-up-dev-env`  

**Expected:**

The setup page title and step count should match.

**Actual:**

The page subtitle says "Quick 4 steps to set up your development environment", but the rendered page has 5 numbered steps:

1. Get your API key and DID
2. Install Rust + WASM toolchain
3. Install the SDK
4. Set up the SDK
5. Authenticate to T3N testnet

**Reproduction:**

```bash
curl -L -s https://r.jina.ai/http://r.jina.ai/http://docs.terminal3.io/developers/adk/get-started/prerequisites/set-up-dev-env | sed -n '1,220p'
```

**Impact:**

Low risk, but it makes a brand-new setup guide look stale and creates a small "did I miss a page?" moment. In a bounty where onboarding bugs count, this is worth fixing.

**Workaround:**

Treat the page as a 5-step setup.

**Suggested fix:**

Change the subtitle to "Quick 5 steps" or merge authentication into Step 4.

---

### CBUG-06 - Next.js/Turbopack server integration can emit SDK worker-thread module errors unless the SDK is externalized

**Severity:** minor  
**Area:** SDK/framework docs  
**Source:** ClaimsPilot temporary repro, `@terminal3/t3n-sdk@3.5.0` and `3.5.2`, `next@16.2.7`  

**Expected:**

The SDK should either work cleanly in common server frameworks or document required framework configuration.

**Actual:**

In a temporary Next.js 16/Turbopack repro with:

- `serverExternalPackages` removed
- `loadWasmComponent()` called with default config
- live `T3N_API_KEY`

The T3 status API still returned a live authenticated session, but Next dev emitted an uncaught worker-thread module error:

```text
Warning: Failed to load the ES module: .../.next/dev/server/assets/worker-thread...
SyntaxError: Cannot use import statement outside a module
uncaughtException: SyntaxError: Cannot use import statement outside a module
```

Adding the SDK to `serverExternalPackages` in `next.config.ts` removed this noisy dev-server failure in ClaimsPilot.

**Reproduction:**

```bash
# In a Next.js App Router server route/page:
import {
  T3nClient,
  loadWasmComponent,
  setEnvironment,
  createEthAuthInput,
  eth_get_address,
  metamask_sign,
} from "@terminal3/t3n-sdk";

setEnvironment("testnet");
const key = process.env.T3N_API_KEY!;
const address = eth_get_address(key);
const client = new T3nClient({
  wasmComponent: await loadWasmComponent(),
  handlers: { EthSign: metamask_sign(address, undefined, key) },
});
await client.handshake();
await client.authenticate(createEthAuthInput(address));
```

Then run:

```bash
npm run dev
curl -s http://localhost:3101/api/t3/status
```

**Impact:**

This does not block authentication, but it creates a scary uncaught exception in the dev server while builders are validating their first live T3N integration. It looks like the SDK/framework integration is unstable.

**Workaround:**

In Next.js, externalize the SDK server-side:

```ts
const nextConfig = {
  serverExternalPackages: ["@terminal3/t3n-sdk"],
};
```

ClaimsPilot also passes the shipped WASM path explicitly, but clean temp repros showed default `loadWasmComponent()` can authenticate successfully in current SDK versions.

**Suggested fix:**

Add a framework note to the SDK README:

- Next.js App Router/Turbopack server usage
- `serverExternalPackages: ["@terminal3/t3n-sdk"]`
- optional explicit `wasmPath`
- supported Node versions

---

## B. Findings Investigated But Not Submitted As Confirmed

### NCONF-01 - One-time low-level WASM path error during early ClaimsPilot development

During early integration, ClaimsPilot once showed:

```text
The "path" argument must be of type string or an instance of URL. Received an instance of URL
```

However, clean repros against `@terminal3/t3n-sdk@3.5.0` and `3.5.2` authenticated successfully in a temp Next app without explicit `wasmPath`.

Because this exact error is not currently reproducible, it is not submitted as a confirmed bug. The only confirmed framework issue kept in this report is CBUG-06, the noisy worker-thread module exception.

## Suggested Fix Priority

1. **CBUG-01** - Update `z-tenant-flight` README privacy model. This is the biggest issue because it can lead builders to expose PII to the agent.
2. **CBUG-03** - Update placeholder quick-tip binding/request shape. This is the most likely copy-paste failure.
3. **CBUG-02** - Remove obsolete manifest guidance from the sample README.
4. **CBUG-04** - Standardize API key env var naming.
5. **CBUG-06** - Add Next.js/Turbopack guidance to SDK README.
6. **CBUG-05** - Fix setup page step count.

## Why This Matters For Terminal 3

Terminal 3's ADK positioning is strongest when builders internalize one idea:

> The agent may reason, but private data and final authority stay behind identity, grants, TEE host capabilities, and audit.

The current docs mostly support that. The biggest gaps above are dangerous because they weaken that exact idea in the first sample a developer is likely to clone.
