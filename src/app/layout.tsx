import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VietBank Fund-Verifier | Multi-Owner Co-Vault & Face-ID Liveness Banking",
  description:
    "Remote multi-owner bank fund verification powered by Supabase, Kilo Gateway 5-Key JWT Rotator, and Yunleng / Tide Raziel / Everything Claude Code / Playwright MCP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
