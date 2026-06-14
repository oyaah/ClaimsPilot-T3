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
