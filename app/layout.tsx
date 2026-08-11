import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    title: "Evaluation Workspace",
    description:
      "An adaptable decision agent for governed, deterministic and human-reviewed evaluations.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Evaluation Workspace",
      description: "Goal to verifiable action packet, within governed boundaries",
      images: [{ url: imageUrl, width: 1672, height: 941, alt: "Evaluation Workspace contract, plan and evidence canvas" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Evaluation Workspace",
      description: "Governed evidence, deterministic comparison, human review",
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
