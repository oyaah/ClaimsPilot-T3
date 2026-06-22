import { AppShell } from "@/components/app-shell";
import { ExternalLink, FileCheck2, ShieldCheck } from "lucide-react";

export default function DocsPage() {
  const liveLinks = [
    ["Canonical live app", "https://claimspilot-backend.onrender.com"],
    ["T3N status", "https://claimspilot-backend.onrender.com/dashboard/t3-status"],
    ["Audit proof", "https://claimspilot-backend.onrender.com/dashboard/audit"],
    ["Frontend mirror", "https://claimspilot-t3-bounty.vercel.app"]
  ];

  const proofRows = [
    ["Registered contract", "z:dc851f7daab01b36a986b212e49673c2bc00f904:claims-policy@0.2.0"],
    ["Approved proof", "CLM-104 approved by live T3N contract"],
    ["Placeholder submit", "PAY-CLM-104, sanitized true, piiEchoed false"],
    ["Denied-host proof", "egress denied for host example.com"]
  ];

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h2>Submission package</h2>
          <p>
            Judge-facing links, proof points, and repo files for the Terminal 3 ADK bounty submission.
          </p>
        </div>
      </div>

      <section className="grid cols-2">
        <div className="panel stack">
          <h3><ExternalLink size={18} aria-hidden="true" /> Live links</h3>
          <table className="table">
            <tbody>
              {liveLinks.map(([label, href]) => (
                <tr key={href}>
                  <th>{label}</th>
                  <td><a href={href}>{href}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel stack">
          <h3><ShieldCheck size={18} aria-hidden="true" /> Proof checklist</h3>
          <table className="table">
            <tbody>
              {proofRows.map(([label, value]) => (
                <tr key={label}>
                  <th>{label}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid cols-2">
        {[
          ["README.md", "Judge-first overview, live links, architecture, and proof summary."],
          ["docs/SUBMISSION.md", "Concise bounty criteria and evidence map."],
          ["docs/TERMINAL3-INTEGRATION.md", "Exact ADK/T3N surfaces used."],
          ["docs/LIVE-PROOF.md", "Captured live contract, placeholder outbound, and egress-denied outputs."],
          ["docs/DEPLOYMENT.md", "Bounty deployment and insurer-ready production path."],
          ["BUGS.md", "Index of reproducible SDK/onboarding findings."],
          ["TERMINAL3_CLAIMSPILOT_CONFIRMED_BUG_REPORT.md", "Detailed bug-bounty evidence and suggested fixes."]
        ].map(([name, detail]) => (
          <div className="panel" key={name}>
            <h3><FileCheck2 size={18} aria-hidden="true" /> {name}</h3>
            <p className="muted">{detail}</p>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
