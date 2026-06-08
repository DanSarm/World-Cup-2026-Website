"use client";

import { useState } from "react";
import { SITE_LOGO_PATH } from "@/lib/site";
import { Flag } from "./Flag";

const SIZE_CLASS = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-24 w-24",
  hero: "h-32 w-32 sm:h-36 sm:w-36",
} as const;

interface SiteLogoProps {
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}

function HostFlags({ compact }: { compact?: boolean }) {
  const flagSize = compact ? "xs" : "md";
  return (
    <div className={`inline-flex items-center ${compact ? "gap-0.5" : "gap-1"}`}>
      <Flag fifaCode="USA" size={flagSize} className="ring-1 ring-black" />
      <Flag fifaCode="MEX" size={flagSize} className="ring-1 ring-black" />
      <Flag fifaCode="CAN" size={flagSize} className="ring-1 ring-black" />
    </div>
  );
}

export function SiteLogo({ size = "md", className = "" }: SiteLogoProps) {
  const [useFallback, setUseFallback] = useState(false);

  if (useFallback) {
    return (
      <div className={className} aria-label="Family Cup 2026">
        <HostFlags compact={size === "sm"} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SITE_LOGO_PATH}
      alt="FIFA World Cup 2026"
      className={`object-contain ${SIZE_CLASS[size]} ${className}`}
      onError={() => setUseFallback(true)}
    />
  );
}
