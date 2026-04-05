import type { Metadata } from "next";
import "./globals.css";
import KindChatWidget from "@/components/chat/KindChatWidget";

export const metadata: Metadata = {
  title: "kind.",
  description: "where the company thinks.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        {children}
        <KindChatWidget />
      </body>
    </html>
  );
}
