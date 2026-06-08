import {
  flagImageUrlForSize,
  flagImageUrl2xForSize,
  flagImageUrlHighRes,
  flagImageUrlHighRes2x,
  type FlagSize,
} from "@/lib/flags";

const SIZE_CLASS: Record<FlagSize, string> = {
  xs: "w-5 h-[15px]",
  sm: "w-7 h-[21px]",
  md: "w-10 h-[30px]",
  lg: "w-14 h-[42px]",
  xl: "w-20 h-[60px]",
};

interface FlagProps {
  fifaCode?: string | null;
  size?: FlagSize;
  className?: string;
  title?: string;
  /** Load w160/w320 assets for crisp rendering at large display sizes */
  highRes?: boolean;
}

export function Flag({
  fifaCode,
  size = "md",
  className = "",
  title,
  highRes = false,
}: FlagProps) {
  if (!fifaCode) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-sm bg-cream text-ink-faint ${SIZE_CLASS[size]} ${className}`}
        aria-hidden
      >
        ⚽
      </span>
    );
  }

  const src = highRes
    ? flagImageUrlHighRes(fifaCode)
    : flagImageUrlForSize(fifaCode, size);
  if (!src) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-sm bg-cream font-team-code text-[10px] font-bold text-ink-muted ${SIZE_CLASS[size]} ${className}`}
        title={title ?? fifaCode}
      >
        {fifaCode}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      srcSet={
        highRes
          ? `${flagImageUrlHighRes2x(fifaCode)} 2x`
          : `${flagImageUrl2xForSize(fifaCode, size)} 2x`
      }
      alt={title ? `${title} flag` : `${fifaCode} flag`}
      title={title}
      width={highRes ? 160 : size === "xs" ? 20 : size === "sm" ? 28 : size === "md" ? 40 : size === "lg" ? 56 : 80}
      height={highRes ? 120 : size === "xs" ? 15 : size === "sm" ? 21 : size === "md" ? 30 : size === "lg" ? 42 : 60}
      className={`flag-img ${SIZE_CLASS[size]} ${className}`}
      loading="eager"
      decoding="async"
    />
  );
}

interface TeamFlagProps {
  team?: { fifa_code: string; short_name?: string; name?: string } | null;
  size?: FlagSize;
  className?: string;
  highRes?: boolean;
}

export function TeamFlag({ team, size = "md", className, highRes }: TeamFlagProps) {
  return (
    <Flag
      fifaCode={team?.fifa_code}
      size={size}
      className={className}
      title={team?.short_name ?? team?.name}
      highRes={highRes}
    />
  );
}
