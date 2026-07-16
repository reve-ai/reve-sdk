import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reve Nodes",
  description:
    "Open-source node-based workflow demo for Reve's public REST API.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/*
          itr8 prototype bridge loader. Resolves the bridge script from the
          itr8 app that embedded this preview (via document.referrer) so it
          works in both local dev and production, without hard-coding an
          origin or port. Safe to remove for a non-itr8 production deploy —
          see README "itr8 review bridge" section.
        */}
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `
(() => {
  const fallback = "https://itr8.ai/itr8-web-preview-bridge.js";
  let origin = "";
  try { origin = new URL(document.referrer).origin; } catch {}
  const script = document.createElement("script");
  script.src = (origin || new URL(fallback).origin) + "/itr8-web-preview-bridge.js";
  script.defer = true;
  document.head.appendChild(script);
})();
`,
          }}
        />
      </head>
      <body className="bg-[#0b0b0f] text-white antialiased">{children}</body>
    </html>
  );
}
