import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VisionRD Agent Console",
  description: "Run the SQL-to-browser automation pipeline from a local UI.",
};

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
