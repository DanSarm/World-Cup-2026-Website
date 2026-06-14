"use client";

import { usePathname } from "next/navigation";
import {
  ADMIN_NAV,
  isNavActive,
  PRIMARY_NAV,
  type NavItem,
} from "@/lib/navConfig";
import { NavIcon } from "./nav/NavIcons";
import { useFastNav } from "./nav/useFastNav";

interface BottomNavProps {
  isAdmin?: boolean;
}

export function BottomNav({ isAdmin }: BottomNavProps) {
  const pathname = usePathname();
  const { navigate, activePath, isNavigating } = useFastNav();

  if (pathname === "/login") return null;

  const items: NavItem[] = isAdmin
    ? [...PRIMARY_NAV, ADMIN_NAV]
    : PRIMARY_NAV;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bottom-nav safe-area-pb"
      aria-label="Main navigation"
    >
      <div
        className={`bottom-nav-bar ${isNavigating ? "bottom-nav-bar--busy" : ""}`}
      >
        {items.map((item) => {
          const active = isNavActive(activePath, item.href);
          const label = item.mobileLabel ?? item.label;

          return (
            <button
              key={item.href}
              type="button"
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              disabled={active}
              onClick={() => navigate(item.href)}
              className={`bottom-nav-item ${active ? "bottom-nav-item--active" : ""}`}
            >
              <span className="bottom-nav-item-indicator" aria-hidden />
              <NavIcon name={item.icon} active={active} />
              <span className="bottom-nav-item-label">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
