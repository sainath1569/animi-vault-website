import type { Metadata, Viewport } from "next";
import { Outfit, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/layout/navbar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { Footer } from "@/components/layout/footer";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { SITE_URL } from "@/lib/env";
import "./globals.css";

const sans = Inter({ variable: "--font-sans", subsets: ["latin"], display: "swap" });
const display = Outfit({ variable: "--font-display", subsets: ["latin"], display: "swap", weight: ["500", "600", "700", "800"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "AniBeast — Watch Anime Free", template: "%s · AniBeast" },
  description: "Stream and track anime. Sub and dub, seasonal charts, airing schedule and your personal watchlist.",
  applicationName: "AniBeast",
  appleWebApp: { capable: true, title: "AniBeast", statusBarStyle: "black-translucent" },
  openGraph: { siteName: "AniBeast", type: "website" },
  icons: { apple: "/pwa-icon/180" },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://s4.anilist.co" />
        <link rel="preconnect" href="https://animevault.up.railway.app" />
      </head>
      <body className="flex min-h-full flex-col">
        <Providers>
          <AnnouncementBar />
          <Navbar />
          <main className="flex-1 pb-[calc(var(--tab-h)+env(safe-area-inset-bottom))] lg:pb-0">{children}</main>
          <Footer />
          <MobileTabBar />
          <ServiceWorkerRegister />
        </Providers>
      </body>
    </html>
  );
}
