export type NavIconKey = "home" | "picks" | "bracket" | "leaderboard" | "admin";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconKey;
  mobileLabel?: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/picks", label: "Picks", icon: "picks" },
  { href: "/bracket", label: "Bracket", icon: "bracket" },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    icon: "leaderboard",
    mobileLabel: "Rankings",
  },
];

export const ADMIN_NAV: NavItem = {
  href: "/admin",
  label: "Admin",
  icon: "admin",
};

export const PREFETCH_HREFS = [
  ...PRIMARY_NAV.map((item) => item.href),
  ADMIN_NAV.href,
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
