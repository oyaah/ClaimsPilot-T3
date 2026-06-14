use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ClaimInput {
    pub claim_id: String,
    pub agent_did: String,
    pub grant_agent_did: String,
    pub claim_type: String,
    pub region: String,
    pub amount_usd: u64,
    pub max_amount_usd: u64,
    pub policy_active: bool,
    pub identity_verified: bool,
    pub host_allowed: bool,
    pub replayed_nonce: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum Decision {
    Approved,
    Denied,
    NeedsEscalation,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum DenialReason {
    AgentNotAuthorized,
    AmountOverLimit,
    PolicyInactive,
    IdentityNotVerified,
    HostNotAllowed,
    ReplayRejected,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ClaimDecision {
    pub decision: Decision,
    pub reasons: Vec<DenialReason>,
}

pub fn evaluate_claim(input: &ClaimInput) -> ClaimDecision {
    let mut reasons = Vec::new();

    if input.agent_did != input.grant_agent_did {
        reasons.push(DenialReason::AgentNotAuthorized);
    }
    if input.amount_usd > input.max_amount_usd {
        reasons.push(DenialReason::AmountOverLimit);
    }
    if !input.policy_active {
        reasons.push(DenialReason::PolicyInactive);
    }
    if !input.identity_verified {
        reasons.push(DenialReason::IdentityNotVerified);
    }
    if !input.host_allowed {
        reasons.push(DenialReason::HostNotAllowed);
    }
    if input.replayed_nonce {
        reasons.push(DenialReason::ReplayRejected);
    }

    let decision = if reasons.is_empty() {
        Decision::Approved
    } else if reasons.contains(&DenialReason::AmountOverLimit) {
        Decision::NeedsEscalation
    } else {
        Decision::Denied
    };

    ClaimDecision { decision, reasons }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_input() -> ClaimInput {
        ClaimInput {
            claim_id: "CLM-104".to_string(),
            agent_did: "did:t3n:agent".to_string(),
            grant_agent_did: "did:t3n:agent".to_string(),
            claim_type: "phone_damage".to_string(),
            region: "US-CA".to_string(),
            amount_usd: 420,
            max_amount_usd: 750,
            policy_active: true,
            identity_verified: true,
            host_allowed: true,
            replayed_nonce: false,
        }
    }

    #[test]
    fn approves_valid_claim() {
        let decision = evaluate_claim(&valid_input());
        assert_eq!(decision.decision, Decision::Approved);
        assert!(decision.reasons.is_empty());
    }

    #[test]
    fn requires_escalation_over_limit() {
        let mut input = valid_input();
        input.amount_usd = 4800;
        let decision = evaluate_claim(&input);
        assert_eq!(decision.decision, Decision::NeedsEscalation);
        assert!(decision.reasons.contains(&DenialReason::AmountOverLimit));
    }

    #[test]
    fn denies_inactive_policy() {
        let mut input = valid_input();
        input.policy_active = false;
        let decision = evaluate_claim(&input);
        assert_eq!(decision.decision, Decision::Denied);
        assert!(decision.reasons.contains(&DenialReason::PolicyInactive));
    }
}

