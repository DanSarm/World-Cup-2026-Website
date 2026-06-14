import type { NavIconKey } from "@/lib/navConfig";

const iconClass = "h-[22px] w-[22px] shrink-0";

export function NavIcon({
  name,
  active = false,
}: {
  name: NavIconKey;
  active?: boolean;
}) {
  const stroke = active ? "currentColor" : "currentColor";
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: active ? 2.25 : 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: iconClass,
    "aria-hidden": true,
  };

  switch (name) {
    case "home":
      return (
        <svg {...props}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
        </svg>
      );
    case "picks":
      return (
        <svg {...props}>
          <path d="M9 6h11M9 12h11M9 18h7" />
          <path d="M4.5 6.5 6 8l2.5-3M4.5 12.5 6 14l2.5-3" />
        </svg>
      );
    case "bracket":
      return (
        <svg {...props}>
          <path d="M4 7h7v4H4zM13 11h7v4h-7zM4 15h7v4H4z" />
          <path d="M11 9h2M11 17h2" />
        </svg>
      );
    case "leaderboard":
      return (
        <svg {...props}>
          <path d="M7 20V10M12 20V4M17 20v-6" />
        </svg>
      );
    case "admin":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      );
  }
}
