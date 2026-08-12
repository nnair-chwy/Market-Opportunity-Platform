import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    title: "Market Intelligence Evaluation Workspace",
    description:
      "Evidence-backed clinic and market evaluations with visible gaps, lineage, and human decision authority.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Market Intelligence Evaluation Workspace",
      description: "Business question to evidence-backed next action, within governed boundaries",
      images: [{ url: imageUrl, width: 1672, height: 941, alt: "Evaluation Workspace contract, plan and evidence canvas" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Market Intelligence Evaluation Workspace",
      description: "Clinic and market evidence, deterministic comparison, human review",
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
