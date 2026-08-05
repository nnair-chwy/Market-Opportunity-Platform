import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    title: "Clinic Location Evaluator",
    description:
      "A transparent, evidence-backed workflow for evaluating candidate Chewy Vet Care locations.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Clinic Location Evaluator",
      description: "Evidence-backed decision support",
      images: [{ url: imageUrl, width: 1674, height: 941, alt: "Clinic Location Evaluator map and evidence score interface" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Clinic Location Evaluator",
      description: "Evidence-backed decision support",
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
