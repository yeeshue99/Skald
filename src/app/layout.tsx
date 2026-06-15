import type { Metadata } from "next";
import { GOOGLE_FONTS_HREF } from "@/lib/themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skald — a social feed for your table",
  description:
    "A private, themeable social feed for your tabletop campaign. Post as NPCs and players, follow each other, schedule reveals.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href={GOOGLE_FONTS_HREF} />
      </head>
      <body className="min-h-dvh bg-bg font-body text-text antialiased">
        {children}
      </body>
    </html>
  );
}
