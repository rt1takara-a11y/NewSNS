import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { MonthPanel } from "@/components/MonthPanel";
import { TabBar } from "@/components/TabBar";

export const metadata: Metadata = {
  title: "RE:ME（リミー）",
  description: "RE:ME（リミー）。毎月、あたらしい自分に。毎月リセットされるSNS。",
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
            <a className="skip-link" href="#main-content">本文へスキップ</a>
            <TabBar />
            <main id="main-content" className="main-column">{children}</main>
            <MonthPanel />
          </div>
        </Providers>
      </body>
    </html>
  );
}

