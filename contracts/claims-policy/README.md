# Claims Policy Contract

This is the policy kernel for the ClaimsPilot Terminal 3 demo.

The TypeScript app contains the runnable demo path. This Rust crate mirrors the policy logic intended for the T3N Rust-to-WASM contract:

- match agent DID to grant
- enforce amount cap
- enforce active policy
- enforce identity verification
- enforce allowed host
- reject replayed nonces

The final live contract should add the generated WIT bindings, `kv-store` replay tracking, `http-with-placeholders` outbound call, and T3N registration/invocation scripts.

