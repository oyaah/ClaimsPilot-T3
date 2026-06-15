//! claims-policy — ClaimsPilot protected claim contract for T3N.
//!
//! `evaluate-claim` is policy-only: it decides allow / deny / needs-escalation
//! for a claim against the caller's delegated grant. `submit-claim` is the
//! approved-claim outbound path: it templates `{{profile.*}}` markers into the
//! insurer payload and calls `host:interfaces/http-with-placeholders`, so
//! plaintext PII is resolved inside the TEE and never enters WASM memory.
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

pub use policy::{
    build_submit_payload, evaluate_claim, ClaimDecision, ClaimInput, SubmitClaimInput,
    SubmitClaimResult,
};

/// Must match `Cargo.toml` `version` and the registration script's semver.
pub const CONTRACT_VERSION: &str = "0.2.0";

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

    fn submit_claim(
        req: exports::claimspilot::claims_policy::contracts::GenericInput,
    ) -> Result<Vec<u8>, String> {
        let input = req
            .input
            .ok_or_else(|| "submit-claim: missing input".to_string())?;
        let claim: policy::SubmitClaimInput =
            serde_json::from_slice(&input).map_err(|e| format!("submit-claim: bad input: {e}"))?;
        submit_claim_wasm(&claim)
            .and_then(|result| serde_json::to_vec(&result).map_err(|e| e.to_string()))
    }
}

#[cfg(target_arch = "wasm32")]
fn submit_claim_wasm(
    input: &policy::SubmitClaimInput,
) -> Result<policy::SubmitClaimResult, String> {
    use crate::host::interfaces::http_with_placeholders as hwp;

    let payload = policy::build_submit_payload(input)?;
    let response = hwp::call(&hwp::Request {
        method: hwp::Verb::Post,
        url: input.destination_url.clone(),
        headers: Some(vec![("Accept".to_string(), "application/json".to_string())]),
        payload: Some(serde_json::to_vec(&payload).map_err(|e| e.to_string())?),
    })
    .map_err(|e| format_http_error(e))?;

    if response.code < 200 || response.code >= 300 {
        return Err(format!("insurer submit failed: HTTP {}", response.code));
    }

    let body: serde_json::Value = serde_json::from_slice(&response.payload)
        .map_err(|e| format!("insurer response is not valid JSON: {e}"))?;

    Ok(policy::SubmitClaimResult {
        status: body["status"].as_str().unwrap_or("submitted").to_string(),
        claim_id: body["claimId"]
            .as_str()
            .unwrap_or(input.claim_id.as_str())
            .to_string(),
        insurer_reference: body["payoutReference"].as_str().map(str::to_string),
        sanitized: body["sanitized"].as_bool().unwrap_or(true),
        pii_echoed: body["piiEchoed"].as_bool().unwrap_or(false),
    })
}

#[cfg(target_arch = "wasm32")]
fn format_http_error(e: host::interfaces::http_with_placeholders::HttpError) -> String {
    use crate::host::interfaces::http_with_placeholders as hwp;

    match e {
        hwp::HttpError::EgressDenied(host) => format!("egress denied for host {host}"),
        hwp::HttpError::PlaceholderDenied(marker) => {
            format!("placeholder not permitted: {marker}")
        }
        hwp::HttpError::PlaceholderUnknown(field) => {
            format!("user profile missing field: {field}")
        }
        hwp::HttpError::PlaceholderNoUserContext => {
            "no user context bound for placeholder resolution".to_string()
        }
        hwp::HttpError::UpstreamError(reason) => format!("upstream: {reason}"),
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
