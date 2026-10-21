import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/layout/BottomNav";
import SplashScreen, { splashBootScript } from "@/components/SplashScreen";
import IosInstallPrompt from "@/components/pwa/IosInstallPrompt";
import AndroidInstallPrompt from "@/components/pwa/AndroidInstallPrompt";
import { ThemeProvider, themeBootScript } from "@/lib/theme";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
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
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#FAF7F2",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${figtree.variable} ${bricolage.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: splashBootScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-ds-bg text-ds-text font-sans">
        <ThemeProvider>
          <div className="max-w-md mx-auto w-full min-h-full flex flex-col bg-ds-bg">
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
