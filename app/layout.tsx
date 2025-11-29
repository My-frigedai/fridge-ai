import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionWrapper from "./SessionWrapper";
import { ThemeProvider } from "@/app/components/ThemeProvider";
import { FridgeProvider } from "@/app/components/FridgeProvider"; 

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fridge AI",
  description: "AIで食材管理・献立作成ができるアプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SessionWrapper>
          <ThemeProvider>
            <FridgeProvider> {/* ✅ ここで全体を包む！ */}
              {children}
            </FridgeProvider>
          </ThemeProvider>
        </SessionWrapper>
      </body>
    </html>
  );
}
