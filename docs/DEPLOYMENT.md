# Deployment

ClaimsPilot runs the live Terminal 3 / T3N SDK and loads a WASM component
server-side. That dictates one hard rule: **all T3N SDK + WASM work must run on
a Node server runtime, never Vercel Edge.**

Two paths: a bare-minimum hosted path for the bounty (Vercel + Render), and a
production-grade insurer-ready path (Cloud Run). Vercel+Render is enough to
demo; Cloud Run is the next step, not a blocker.

## Minimum hosted path — Vercel + Render

```text
Vercel (Next.js UI)  ──HTTP──►  Render (Node API/worker)  ──►  T3N testnet
                                         │
                                         └──►  registration state / proof artifacts
```

- **Vercel** serves the Next.js UI. Keep any route that touches the SDK on the
  Node runtime (`export const runtime = "nodejs"`), or proxy it to Render. In
  this repo, setting `CLAIMSPILOT_BACKEND_URL` on Vercel rewrites `/api/*` to
  the Render service.
- **Render** owns live SDK/WASM operations: `npm run t3:register`,
  `npm run t3:invoke`, and the `/api/t3/contract/*` routes. Render runs a normal
  Node container, so `loadWasmComponent` and the shipped `session.core.wasm`
  work without Edge constraints.

### Environment variables

| Var | Owner | Notes |
|-----|-------|-------|
| `T3N_API_KEY` | Render (secret) | Never exposed to the browser or Vercel client bundle. |
| `OPENAI_API_KEY` | Render (secret) | Agent narration only. |
| `CLAIMSPILOT_T3_ENVIRONMENT` | both | `testnet` for the bounty. |
| `CLAIMSPILOT_DEMO_MODE` | both | `false` for live; `true` for offline recording. |
| `NEXT_PUBLIC_T3_DID` | both | Public DID label for the UI. |
| `CLAIMSPILOT_INSURER_BASE_URL` | Render | Public base URL whose `/api/mock-insurer/payouts` route T3N can reach for U6 placeholder outbound. |
| `CLAIMSPILOT_BACKEND_URL` | Vercel | Render service URL; enables Vercel frontend to proxy `/api/*` to Render. |
| `CLAIMSPILOT_CONTRACT_SCRIPT_NAME` | Render | Public-safe registered script name, e.g. `z:<tenant>:claims-policy`. |
| `CLAIMSPILOT_CONTRACT_VERSION` | Render | `0.2.0` for U6. |
| `CLAIMSPILOT_CONTRACT_TENANT_DID` | Render | Public-safe tenant DID from registration. |

### Build & run

- Build: `npm install && npm run build`
- Contract build (one-time, on a machine with the Rust `wasm32-wasip2` target):
  `npm run t3:build-contract`
- Register (Render shell / job): `npm run t3:register`
- Health: `GET /api/t3/status` (live SDK) and `GET /api/t3/contract/status`
  (registration + decision source).

### Secrets

- Set keys only as Render/Vercel secret env vars. Never commit `.env.local`.
- `.claimspilot-state/` (registration metadata) is gitignored and public-safe by
  construction (no keys), but treat it as deploy state, not source.
- Rotate any key that was ever pasted into chat or a demo before going public.

## Production path — Cloud Run (insurer-ready)

Cloud Run is the stronger insurer story because runtime, secrets, audit data,
jobs, and IAM live under one cloud boundary.

```text
Cloud Run service (app/API, Node)
  ├─ Secret Manager        → T3N_API_KEY, OPENAI_API_KEY
  ├─ Cloud SQL (Postgres)  → audit + proof storage (replaces local JSON)
  ├─ Cloud Tasks           → queued contract register/invoke work
  └─ Cloud Run Jobs        → one-off registration / migrations
```

- **One container image for app + API first.** Split a dedicated worker/job only
  when queue volume or operational separation demands it.
- **Secret Manager** holds `T3N_API_KEY` / `OPENAI_API_KEY`; mount as runtime
  secrets, never bake into the image.
- **Cloud SQL (Postgres)** replaces the local `.claimspilot-state/` JSON for
  audit/proof once multi-instance durability matters.
- **Cloud Tasks** authenticated HTTP targets run register/invoke off the request
  path; **Cloud Run Jobs** handle one-shot registration and migrations.

### Why this is the insurer path

Insurers ask the same questions the bounty does: where does enforcement run, who
can act, what is audited, and how are secrets handled. Cloud Run answers all four
with managed IAM + Secret Manager + Cloud SQL audit + queue isolation — without
changing the product or the T3N contract.

## Deferred (not needed for the bounty)

- Full Cloud Run Terraform, VPC, and observability wiring.
- Moving all audit/proof storage off local JSON to managed Postgres.
- Real insurer credentials and production partner API integration.
