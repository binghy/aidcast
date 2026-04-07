import type { Metadata } from "next";
import "./globals.css";
import MiniAppClientProvider from "@/components/MiniAppClientProvider";

export const metadata: Metadata = {
  title: "AIdCast",
  description: "AI-powered mutual aid app connecting people who need help with those who can offer it",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <MiniAppClientProvider>{children}</MiniAppClientProvider>
      </body>
    </html>
  );
}