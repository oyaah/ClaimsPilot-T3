//! Pure claim-policy decision logic. No PII, no host calls, no WASM bindings —
//! native-testable and a 1:1 parity oracle for `lib/domain/policy.ts`.
//!
//! `ClaimInput` is the sanitized policy envelope the app builds from a Claim +
//! Grant before invoking the contract. It deliberately contains NO claimant
//! name, document, or contact data — only the scope fields the decision needs.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ClaimInput {
    pub agent_did: String,
    pub grant_agent_did: String,
    pub claim_type: String,
    pub allowed_claim_types: Vec<String>,
    pub region: String,
    pub allowed_regions: Vec<String>,
    pub amount_usd: u64,
    pub max_amount_usd: u64,
    pub policy_active: bool,
    pub requires_policy_active: bool,
    pub identity_verified: bool,
    pub requires_identity_verified: bool,
    pub destination_host: String,
    pub allowed_hosts: Vec<String>,
    pub grant_revoked: bool,
    pub grant_expired: bool,
    pub replayed_nonce: bool,
    /// Placeholder markers the contract would template into a later insurer
    /// call (e.g. `{{profile.first_name}}`). Resolved values never appear here.
    pub pii_placeholders: Vec<String>,
    pub allowed_placeholders: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ClaimDecision {
    /// "approved" | "denied" | "needs_escalation" — matches the TS `Decision`.
    pub decision: String,
    /// snake_case reasons matching the TS `DenialReason` union.
    pub reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct SubmitClaimInput {
    pub claim_id: String,
    pub amount_usd: u64,
    pub claimant_ref: String,
    pub destination_url: String,
    pub idempotency_key: String,
    /// Placeholder markers only. Resolved PII values must never be contract
    /// arguments.
    pub placeholders: Vec<String>,
    pub allowed_placeholders: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SubmitClaimResult {
    pub status: String,
    pub claim_id: String,
    pub insurer_reference: Option<String>,
    pub sanitized: bool,
    pub pii_echoed: bool,
}

/// Evaluate a claim against its grant. Mirrors `evaluateClaimPolicy` in
/// `lib/domain/policy.ts`: same checks, same ordering, same escalation rule.
pub fn evaluate_claim(input: &ClaimInput) -> ClaimDecision {
    let mut reasons: Vec<String> = Vec::new();
    let push = |reasons: &mut Vec<String>, r: &str| reasons.push(r.to_string());

    if input.grant_agent_did != input.agent_did {
        push(&mut reasons, "agent_not_authorized");
    }
    if input.grant_revoked {
        push(&mut reasons, "grant_revoked");
    }
    if input.grant_expired {
        push(&mut reasons, "grant_expired");
    }
    if !input.allowed_claim_types.contains(&input.claim_type) {
        push(&mut reasons, "claim_type_not_allowed");
    }
    if !input.allowed_regions.contains(&input.region) {
        push(&mut reasons, "claim_type_not_allowed");
    }
    let over_limit = input.amount_usd > input.max_amount_usd;
    if over_limit {
        push(&mut reasons, "amount_over_limit");
    }
    if input.requires_policy_active && !input.policy_active {
        push(&mut reasons, "policy_inactive");
    }
    if input.requires_identity_verified && !input.identity_verified {
        push(&mut reasons, "identity_not_verified");
    }
    if !input.allowed_hosts.contains(&input.destination_host) {
        push(&mut reasons, "host_not_allowed");
    }
    if input.replayed_nonce {
        push(&mut reasons, "replay_rejected");
    }
    if input
        .pii_placeholders
        .iter()
        .any(|field| !input.allowed_placeholders.contains(field))
    {
        push(&mut reasons, "placeholder_not_permitted");
    }

    // Escalation rule mirrors the TS ternary: an over-limit claim is
    // escalatable, anything else with reasons is a hard deny.
    let decision = if reasons.is_empty() {
        "approved"
    } else if over_limit {
        "needs_escalation"
    } else {
        "denied"
    };

    ClaimDecision {
        decision: decision.to_string(),
        reasons,
    }
}

pub fn validate_submit_claim_input(input: &SubmitClaimInput) -> Result<(), String> {
    if input.claim_id.trim().is_empty() {
        return Err("submit-claim: claim_id is required".to_string());
    }
    if input.destination_url.trim().is_empty() {
        return Err("submit-claim: destination_url is required".to_string());
    }
    if input.idempotency_key.trim().len() < 4 {
        return Err("submit-claim: idempotency_key is too short".to_string());
    }
    if input
        .placeholders
        .iter()
        .any(|field| !input.allowed_placeholders.contains(field))
    {
        return Err("placeholder_not_permitted".to_string());
    }
    Ok(())
}

pub fn build_submit_payload(input: &SubmitClaimInput) -> Result<serde_json::Value, String> {
    validate_submit_claim_input(input)?;
    let mut claimant = serde_json::Map::new();
    for placeholder in &input.placeholders {
        let key = match placeholder.as_str() {
            "{{profile.first_name}}" => "firstName",
            "{{profile.last_name}}" => "lastName",
            "{{profile.date_of_birth}}" => "dateOfBirth",
            "{{profile.verified_contacts.email.value}}" => "email",
            _ => return Err(format!("unsupported placeholder: {placeholder}")),
        };
        claimant.insert(key.to_string(), serde_json::json!(placeholder));
    }

    Ok(serde_json::json!({
        "claimId": input.claim_id,
        "amountUsd": input.amount_usd,
        "idempotencyKey": input.idempotency_key,
        "claimantRef": input.claimant_ref,
        "claimant": claimant,
        "placeholders": input.placeholders
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_input() -> ClaimInput {
        ClaimInput {
            agent_did: "did:t3n:agent".into(),
            grant_agent_did: "did:t3n:agent".into(),
            claim_type: "phone_damage".into(),
            allowed_claim_types: vec!["phone_damage".into()],
            region: "US-CA".into(),
            allowed_regions: vec!["US-CA".into()],
            amount_usd: 420,
            max_amount_usd: 750,
            policy_active: true,
            requires_policy_active: true,
            identity_verified: true,
            requires_identity_verified: true,
            destination_host: "api.mock-insurer.test".into(),
            allowed_hosts: vec!["api.mock-insurer.test".into()],
            grant_revoked: false,
            grant_expired: false,
            replayed_nonce: false,
            pii_placeholders: vec!["{{profile.first_name}}".into()],
            allowed_placeholders: vec!["{{profile.first_name}}".into()],
        }
    }

    #[test]
    fn approves_valid_claim() {
        let d = evaluate_claim(&valid_input());
        assert_eq!(d.decision, "approved");
        assert!(d.reasons.is_empty());
    }

    #[test]
    fn escalates_over_limit() {
        let mut i = valid_input();
        i.amount_usd = 4800;
        let d = evaluate_claim(&i);
        assert_eq!(d.decision, "needs_escalation");
        assert!(d.reasons.contains(&"amount_over_limit".to_string()));
    }

    #[test]
    fn denies_inactive_policy() {
        let mut i = valid_input();
        i.policy_active = false;
        let d = evaluate_claim(&i);
        assert_eq!(d.decision, "denied");
        assert!(d.reasons.contains(&"policy_inactive".to_string()));
    }

    #[test]
    fn denies_unauthorized_agent() {
        let mut i = valid_input();
        i.agent_did = "did:t3n:someone-else".into();
        let d = evaluate_claim(&i);
        assert_eq!(d.decision, "denied");
        assert!(d.reasons.contains(&"agent_not_authorized".to_string()));
    }

    #[test]
    fn denies_replayed_nonce() {
        let mut i = valid_input();
        i.replayed_nonce = true;
        let d = evaluate_claim(&i);
        assert_eq!(d.decision, "denied");
        assert!(d.reasons.contains(&"replay_rejected".to_string()));
    }

    #[test]
    fn denies_missing_host_grant() {
        let mut i = valid_input();
        i.allowed_hosts = vec![];
        let d = evaluate_claim(&i);
        assert_eq!(d.decision, "denied");
        assert!(d.reasons.contains(&"host_not_allowed".to_string()));
    }

    #[test]
    fn denies_disallowed_region() {
        let mut i = valid_input();
        i.region = "EU".into();
        let d = evaluate_claim(&i);
        assert_eq!(d.decision, "denied");
        assert!(d.reasons.contains(&"claim_type_not_allowed".to_string()));
    }

    #[test]
    fn denies_unpermitted_placeholder() {
        let mut i = valid_input();
        i.pii_placeholders = vec!["{{profile.ssn}}".into()];
        let d = evaluate_claim(&i);
        assert_eq!(d.decision, "denied");
        assert!(d.reasons.contains(&"placeholder_not_permitted".to_string()));
    }

    fn valid_submit_input() -> SubmitClaimInput {
        SubmitClaimInput {
            claim_id: "CLM-104".into(),
            amount_usd: 420,
            claimant_ref: "claimant_104".into(),
            destination_url: "https://claimspilot.example.com/api/mock-insurer/payouts".into(),
            idempotency_key: "CLM-104:grant_demo:420".into(),
            placeholders: vec![
                "{{profile.first_name}}".into(),
                "{{profile.last_name}}".into(),
                "{{profile.date_of_birth}}".into(),
                "{{profile.verified_contacts.email.value}}".into(),
            ],
            allowed_placeholders: vec![
                "{{profile.first_name}}".into(),
                "{{profile.last_name}}".into(),
                "{{profile.date_of_birth}}".into(),
                "{{profile.verified_contacts.email.value}}".into(),
            ],
        }
    }

    #[test]
    fn submit_payload_contains_only_placeholder_markers() {
        let mut input = valid_submit_input();
        input.placeholders = vec![
            "{{profile.first_name}}".into(),
            "{{profile.last_name}}".into(),
        ];
        let payload = build_submit_payload(&input).unwrap();
        let serialized = serde_json::to_string(&payload).unwrap();

        assert!(serialized.contains("{{profile.first_name}}"));
        assert!(serialized.contains("{{profile.last_name}}"));
        assert!(!serialized.contains("{{profile.date_of_birth}}"));
        assert!(!serialized.contains("Jane"));
        assert!(!serialized.contains("Doe"));
    }

    #[test]
    fn submit_input_rejects_unknown_raw_pii_fields() {
        let raw = serde_json::json!({
            "claim_id": "CLM-104",
            "amount_usd": 420,
            "claimant_ref": "claimant_104",
            "destination_url": "https://claimspilot.example.com/api/mock-insurer/payouts",
            "idempotency_key": "CLM-104:grant_demo:420",
            "placeholders": ["{{profile.first_name}}"],
            "allowed_placeholders": ["{{profile.first_name}}"],
            "first_name": "Jane"
        });

        let parsed = serde_json::from_value::<SubmitClaimInput>(raw);
        assert!(parsed.is_err());
    }

    #[test]
    fn submit_input_rejects_unpermitted_placeholder() {
        let mut input = valid_submit_input();
        input.placeholders = vec!["{{profile.ssn}}".into()];

        let result = build_submit_payload(&input);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "placeholder_not_permitted");
    }

    #[test]
    fn over_limit_takes_escalation_even_with_other_denials() {
        // matches TS: amount_over_limit present => needs_escalation, not denied
        let mut i = valid_input();
        i.amount_usd = 4800;
        i.identity_verified = false;
        let d = evaluate_claim(&i);
        assert_eq!(d.decision, "needs_escalation");
        assert!(d.reasons.contains(&"identity_not_verified".to_string()));
    }
}
