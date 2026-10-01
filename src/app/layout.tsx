import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/layout/BottomNav";
import SplashScreen from "@/components/SplashScreen";
import IosInstallPrompt from "@/components/pwa/IosInstallPrompt";
import AndroidInstallPrompt from "@/components/pwa/AndroidInstallPrompt";
import { ThemeProvider, themeBootScript } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DropSpot",
  description:
    "Découvre les meilleurs cafés locaux, drops et vibes en temps réel.",
  applicationName: "DropSpot",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DropSpot",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#FAF9F6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="min-h-full flex flex-col bg-brand-oat text-brand-espresso">
        <ThemeProvider>
          <div className="max-w-md mx-auto w-full min-h-full flex flex-col bg-brand-oat">
            {children}
            <BottomNav />
          </div>
          <IosInstallPrompt />
          <AndroidInstallPrompt />
          <SplashScreen />
        </ThemeProvider>
      </body>
    </html>
  );
}
