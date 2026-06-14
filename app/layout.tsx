import { Archivo, Saira_Condensed } from "next/font/google";
import { getSession } from "@/lib/session";
import { Nav } from "@/components/Nav";
import { BottomNav } from "@/components/BottomNav";
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

export const metadata = {
  title: "Family Cup 2026",
  description: "Private friends & family World Cup prediction pool",
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
        <div className="relative z-10 min-h-dvh flex flex-col">
          <Nav isAdmin={session?.is_admin} />
          <div className="border-b border-white/5 bg-black/50 py-2">
            <div className="max-w-2xl mx-auto px-4">
              <FlagMarquee />
            </div>
          </div>
          <main className="flex-1 w-full px-4 py-6 md:py-8 pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-10">
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
