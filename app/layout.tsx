import { Archivo, Saira_Condensed } from "next/font/google";
import type { Viewport } from "next";
import { getSession } from "@/lib/session";
import { APPLE_TOUCH_ICON_PATH, APP_ICON_LARGE_PATH } from "@/lib/site";
import { Nav } from "@/components/Nav";
import { BottomNav } from "@/components/BottomNav";
import { NotificationsSlot } from "@/components/NotificationsSlot";
import { RulesModal } from "@/components/RulesModal";
import { FlagMarquee } from "@/components/FlagMarquee";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const sairaCondensed = Saira_Condensed({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-saira-condensed",
  display: "swap",
});

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#002868",
  colorScheme: "dark",
};

export const metadata = {
  title: "Family Cup 2026",
  description: "Private friends & family World Cup prediction pool",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: APP_ICON_LARGE_PATH, sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: APPLE_TOUCH_ICON_PATH, sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default" as const,
    title: "Family Cup 2026",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="en" className={`${archivo.variable} ${sairaCondensed.variable}`}>
      <body className={`app-bg ${archivo.className}`}>
        <div className="relative z-10 min-h-[100dvh] min-h-[100svh] min-h-[-webkit-fill-available] flex flex-col">
          <Nav isAdmin={session?.is_admin} />
          <div className="border-b border-white/5 bg-black/50 py-2">
            <div className="max-w-2xl mx-auto px-4">
              <FlagMarquee />
            </div>
          </div>
          <main className="flex-1 w-full px-4 py-6 md:py-8 pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-10 pt-[env(safe-area-inset-top,0px)]">
            <NotificationsSlot enabled={Boolean(session)} />
            {children}
          </main>
          <BottomNav isAdmin={session?.is_admin} />
          <div className="md:hidden fixed top-4 right-4 z-30">
            {session && <RulesModal variant="mobile" />}
          </div>
        </div>
      </body>
    </html>
  );
}
