import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { TempoInit } from "./tempo-init";
import "../src/app/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chatbot Frontend",
  description: "Next.js frontend for the chatbot with agent capabilities",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Script src="https://api.tempo.new/proxy-asset?url=https://storage.googleapis.com/tempo-public-assets/error-handling.js" />
        <TempoInit />
        {children}
      </body>
    </html>
  );
}
