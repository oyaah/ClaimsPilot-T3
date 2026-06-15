# ClaimsPilot Demo Script

## Goal

Show a judge that ClaimsPilot is not a chat UI with a security sticker. The agent proposes claim actions, but Terminal 3-style grants, policy checks, placeholder PII handling, and audit rows control execution.

For the recorded version, use [VIDEO-SCRIPT.md](VIDEO-SCRIPT.md). This file is the short live-demo checklist.

## Three-Minute Flow

1. Open T3 Status.
   - URL: `https://claimspilot-backend.onrender.com/dashboard/t3-status`.
   - Point at `LIVE`, DID, testnet environment, and credits.

2. Open Agent.
   - Point at `live OpenAI planner`.
   - Point out that OpenAI writes the narrative, but the protected policy decision is still fixed by the grant layer.

3. Open the command center.
   - Point at active grant: `$750`, phone/travel, approved regions, `mock-insurer.local`.
   - Point at agent DID.

4. Run `CLM-104`.
   - Expected: approved.
   - Say: "This is inside grant scope, so the live T3N contract approves."

5. Open Audit.
   - URL: `https://claimspilot-backend.onrender.com/dashboard/audit`.
   - Show `claim.approve` and `claim.submit`.
   - Say: "`submit-claim` used `http-with-placeholders`; direct proof returned `PAY-CLM-104`, `sanitized: true`, `piiEchoed: false`."

6. Run or discuss `CLM-219`.
   - Expected: needs escalation because `$4,800` exceeds `$750`.
   - Say: "The agent can ask, but cannot self-approve."

7. Open Grants and escalate.
   - Expected: cap moves to at least `$5,000` and medical is added to allowed claim types.

8. Retry the high-value claim.
   - Expected: approved after explicit escalation.

9. Revoke the agent.
   - Expected: subsequent protected actions are blocked.

10. Open Audit.
   - Show allow, deny, escalation, revoke, and reasons.

11. Open `docs/LIVE-PROOF.md`.
   - Show `egress denied for host example.com` as the ungranted-host proof.

## Judge Soundbite

ClaimsPilot proves the Terminal 3 pattern: the AI agent does not hold raw PII or unlimited payout authority. The model writes the narrative; T3N verifies identity, checks grants, substitutes private references inside the enclave, authorizes outbound hosts, and writes the audit row.
