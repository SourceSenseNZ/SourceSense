import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SourceSense",
  description: "Analyze news articles in a polished, theme-aware workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
