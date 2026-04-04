import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KIN",
  description: "Executive operating system for Kind Tech",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
