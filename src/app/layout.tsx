import type { Metadata } from "next";
import { Geist_Mono, Public_Sans } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BANKABLE · AVA Branchenzuordnung",
  description: "Describe your industry — AVA assigns linked Hauptbranche + Detailbranche",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={`${publicSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
