import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadHunter",
  description: "AI agent that finds customers and books meetings for your business",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <a href="/" className="brand">LeadHunter</a>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
