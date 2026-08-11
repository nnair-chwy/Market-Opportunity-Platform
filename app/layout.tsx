import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    title: "Market Intelligence",
    description:
      "A question-first workspace that traces decisions and prepares reviewable action packets.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Market Intelligence",
      description: "Question-first decision support and reviewable action packets",
      images: [{ url: imageUrl, width: 1674, height: 941, alt: "Market Intelligence decision workflow" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Market Intelligence",
      description: "Question-first decision support and reviewable action packets",
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
