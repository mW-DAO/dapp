import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./fonts.css";
import { Web3Provider } from "@/context/Web3Provider";
import { Toaster } from "sonner";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersObj = await headers();
  const cookies = headersObj.get("cookie");

  return (
    <html lang="zh-CN">
      <body
        className="min-h-screen bg-gray-50 pb-24 text-slate-900 antialiased"
        style={{
          fontFamily:
            'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
        }}
      >
        <Web3Provider cookies={cookies}>
          {children}
          <Toaster position="top-center" richColors />
        </Web3Provider>
      </body>
    </html>
  );
}
