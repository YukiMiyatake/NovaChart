import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NovaChart - LoL Rating Tracker",
  description: "Track and analyze your League of Legends rating progression",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

