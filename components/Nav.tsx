"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RulesModal } from "./RulesModal";
import { SiteLogo } from "./SiteLogo";
import { ADMIN_NAV, isNavActive, PRIMARY_NAV } from "@/lib/navConfig";

interface NavProps {
  isAdmin?: boolean;
}

export function Nav({ isAdmin }: NavProps) {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  const links = isAdmin ? [...PRIMARY_NAV, ADMIN_NAV] : PRIMARY_NAV;

  return (
    <header className="hidden md:block sticky top-0 z-40 border-b border-white/10 backdrop-blur-xl bg-black/85">
      <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" prefetch className="flex items-center gap-2.5">
          <SiteLogo size="sm" />
          <div>
            <span className="font-extrabold text-white tracking-tight text-sm leading-none block">
              Family Cup
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gold/80">
              2026
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          {links.map((link) => {
            const active = isNavActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch
                className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  active
                    ? "bg-white/10 text-gold-light"
                    : "text-white/50 hover:text-white/90 hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="ml-2 pl-2 border-l border-white/10">
            <RulesModal />
          </div>
        </nav>
      </div>
    </header>
  );
}
