import type { Metadata } from "next";
import { Inter, Crimson_Pro } from "next/font/google";
import { SettingsProvider } from "@/providers/SettingsProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const crimsonPro = Crimson_Pro({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Solara Insights — Calm guidance from the light",
  description: "A calm, emotionally intelligent astrology sanctuary offering daily guidance, birth chart insights, and relational wisdom.",
  keywords: ["astrology", "horoscope", "birth chart", "tarot", "numerology", "emotional intelligence"],
  other: {
    "facebook-domain-verification": "hyj8djhnldcam7i63cp0fg6es2n5v0",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${crimsonPro.variable}`}>
      <body>
        <SettingsProvider>{children}</SettingsProvider>
      </body>
    </html>
  );
}
