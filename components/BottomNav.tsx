"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface BottomNavProps {
  isAdmin?: boolean;
}

const links = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/picks", label: "Picks", icon: "⚽" },
  { href: "/big-picks", label: "Big", icon: "🏆" },
  { href: "/leaderboard", label: "Rank", icon: "📊" },
];

export function BottomNav({ isAdmin }: BottomNavProps) {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  const allLinks = isAdmin
    ? [...links, { href: "/admin", label: "Admin", icon: "⚙️" }]
    : links;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 safe-area-pb">
      <div className="mx-3 mb-3 rounded-2xl border border-white/10 bg-black/90 backdrop-blur-xl shadow-2xl shadow-black/40">
        <div className="flex justify-around py-2 px-1">
          {allLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link min-w-[56px] ${
                pathname === link.href ? "nav-link-active" : ""
              }`}
            >
              <span className="text-xl leading-none">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
