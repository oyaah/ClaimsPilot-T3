import Link from "next/link";
import { Activity, Bot, ClipboardList, FileCheck2, KeyRound, ShieldCheck } from "lucide-react";

const nav = [
  { href: "/", label: "Command", icon: Activity },
  { href: "/dashboard/agent", label: "Agent", icon: Bot },
  { href: "/dashboard/grants", label: "Grants", icon: KeyRound },
  { href: "/dashboard/audit", label: "Audit", icon: ClipboardList },
  { href: "/dashboard/t3-status", label: "T3 status", icon: ShieldCheck },
  { href: "/dashboard/docs", label: "Submission", icon: FileCheck2 }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">CP</div>
          <div>
            <h1>ClaimsPilot</h1>
            <p>T3N protected actions</p>
          </div>
        </div>
        <nav className="nav" aria-label="ClaimsPilot navigation">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
