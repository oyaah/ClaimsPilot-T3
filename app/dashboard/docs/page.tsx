import { AppShell } from "@/components/app-shell";
import { FileCheck2 } from "lucide-react";

export default function DocsPage() {
  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h2>Submission package</h2>
          <p>
            The build track pitch stays product-first. SDK/docs findings live separately in BUGS.md.
          </p>
        </div>
      </div>
      <section className="grid cols-2">
        {[
          ["README.md", "Problem, quickstart, architecture, live/demo boundary."],
          ["docs/DEMO-SCRIPT.md", "Three-minute judge walkthrough."],
          ["docs/TERMINAL3-INTEGRATION.md", "Exact ADK/T3N surfaces used."],
          ["docs/LIVE-PROOF.md", "Captured live-status and contract outputs."],
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

