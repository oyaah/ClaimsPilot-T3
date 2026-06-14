//! claims-policy — ClaimsPilot protected claim-decision contract for T3N.
//!
//! Policy-only: the contract decides allow / deny / needs-escalation for a
//! claim against the caller's delegated grant. It carries NO claimant PII —
//! the input is the sanitized policy envelope only (see `policy::ClaimInput`).
//! The PII-bearing insurer call is a later milestone that uses
//! `host:interfaces/http-with-placeholders` so plaintext PII is resolved inside
//! the TEE and never enters WASM memory.
//!
//! Build the WASM component:
//! ```text
//! rustup target add wasm32-wasip2
//! cargo build --target wasm32-wasip2 --release
//! # => target/wasm32-wasip2/release/claims_policy.wasm
//! ```
//!
//! Native unit tests (host target) still run with `cargo test`.
#![cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]

pub mod policy;

pub use policy::{evaluate_claim, ClaimDecision, ClaimInput};

/// Must match `Cargo.toml` `version` and the registration script's semver.
pub const CONTRACT_VERSION: &str = "0.1.0";

wit_bindgen::generate!({
    world: "claims-policy",
    path: "wit",
    generate_all,
});

struct Component;

#[cfg(target_arch = "wasm32")]
impl exports::claimspilot::claims_policy::contracts::Guest for Component {
    fn evaluate_claim(
        req: exports::claimspilot::claims_policy::contracts::GenericInput,
    ) -> Result<Vec<u8>, String> {
        let input = req
            .input
            .ok_or_else(|| "evaluate-claim: missing input".to_string())?;
        let claim: policy::ClaimInput = serde_json::from_slice(&input)
            .map_err(|e| format!("evaluate-claim: bad input: {e}"))?;
        let decision = policy::evaluate_claim(&claim);
        serde_json::to_vec(&decision).map_err(|e| e.to_string())
    }
}

#[cfg(target_arch = "wasm32")]
export!(Component);

#[cfg(test)]
mod tests {
    use super::CONTRACT_VERSION;

    #[test]
    fn contract_version_is_semver() {
        let parts: Vec<&str> = CONTRACT_VERSION.split('.').collect();
        assert_eq!(parts.len(), 3, "CONTRACT_VERSION must be MAJOR.MINOR.PATCH");
        assert!(parts.iter().all(|p| p.parse::<u32>().is_ok()));
    }
}
