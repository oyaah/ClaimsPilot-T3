import { AppShell } from "@/components/app-shell";
import { ExternalLink, FileCheck2, ShieldCheck } from "lucide-react";

export default function DocsPage() {
  const liveLinks = [
    ["Live frontend", "https://claimspilot-t3-bounty.vercel.app"],
    ["Backend proof", "https://claimspilot-backend.onrender.com"],
    ["T3N status", "https://claimspilot-backend.onrender.com/dashboard/t3-status"],
    ["Audit proof", "https://claimspilot-backend.onrender.com/dashboard/audit"]
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
          ["docs/JUDGE-WALKTHROUGH.md", "Shortest path for judges to verify the project."],
          ["docs/VIDEO-SCRIPT.md", "Four-to-five-minute demo recording script."],
          ["docs/TERMINAL3-INTEGRATION.md", "Exact ADK/T3N surfaces used."],
          ["docs/LIVE-PROOF.md", "Captured live contract, placeholder outbound, and egress-denied outputs."],
          ["BUGS.md", "Reproducible SDK/onboarding findings."]
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
