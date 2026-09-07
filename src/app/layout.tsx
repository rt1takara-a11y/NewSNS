import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { TabBar } from "@/components/TabBar";

export const metadata: Metadata = {
  title: "NewSNS（試作品）",
  description: "毎月すべてがリセットされるSNS。試作品。",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <Providers>
          <div className="app">
            {children}
            <TabBar />
          </div>
        </Providers>
      </body>
    </html>
  );
}
