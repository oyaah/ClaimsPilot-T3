# ClaimsPilot Demo Script

## Goal

Show a judge that ClaimsPilot is not a chat UI with a security sticker. The agent proposes claim actions, but Terminal 3-style grants, policy checks, placeholder PII handling, and audit rows control execution.

## Three-Minute Flow

1. Open Agent.
   - Point at `live OpenAI planner`.
   - Point out that OpenAI writes the narrative, but the protected policy decision is still fixed by the grant layer.

2. Open the command center.
   - Point at active grant: `$750`, phone/travel, approved regions, `mock-insurer.local`.
   - Point at agent DID.

3. Run `CLM-104`.
   - Expected: approved.
   - Say: "This is inside grant scope, so the protected action can proceed."

4. Run `CLM-219`.
   - Expected: needs escalation because `$4,800` exceeds `$750`.
   - Say: "The agent can ask, but cannot self-approve."

5. Open Grants and escalate.
   - Expected: cap moves to at least `$5,000` and medical is added to allowed claim types.

6. Retry the high-value claim.
   - Expected: approved after explicit escalation.

7. Revoke the agent.
   - Expected: subsequent protected actions are blocked.

8. Open Audit.
   - Show allow, deny, escalation, revoke, and reasons.

9. Open T3 Status.
   - If live key exists, show DID and credits.
   - If not, show demo/error honestly.

## Judge Soundbite

ClaimsPilot proves the Terminal 3 pattern: the AI agent does not hold raw PII or unlimited payout authority. The action layer verifies identity, checks grants, substitutes private references outside the agent, and writes an audit row.
