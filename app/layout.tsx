import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClaimsPilot",
  description: "Terminal 3 protected insurance claims agent"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

