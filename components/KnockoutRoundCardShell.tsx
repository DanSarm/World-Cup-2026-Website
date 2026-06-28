"use client";

import type { ReactNode } from "react";
import type { Match } from "@/lib/types";
import { isKnockoutStage } from "@/lib/types";
import { getKnockoutRoundCardTheme } from "@/lib/knockoutRoundTheme";

interface KnockoutRoundCardShellProps {
  match: Pick<Match, "stage">;
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
}

export function knockoutRoundCardClasses(
  stage: Match["stage"],
  base = "card p-0 overflow-hidden"
): string {
  const theme = getKnockoutRoundCardTheme(stage);
  return [base, theme?.wrapperClass].filter(Boolean).join(" ");
}

export function KnockoutRoundCardShell({
  match,
  children,
  className = "card p-0 overflow-hidden",
  as: Tag = "div",
}: KnockoutRoundCardShellProps) {
  const roundTheme = getKnockoutRoundCardTheme(match.stage);

  return (
    <Tag className={knockoutRoundCardClasses(match.stage, className)}>
      {roundTheme && (
        <div className={roundTheme.ribbonClass}>
          <span>{roundTheme.label}</span>
        </div>
      )}
      <div className={roundTheme ? "relative z-[1]" : undefined}>{children}</div>
    </Tag>
  );
}

export function KnockoutRoundCardShellIfNeeded({
  match,
  children,
  className = "card p-0 overflow-hidden",
  as = "div",
}: KnockoutRoundCardShellProps) {
  if (!isKnockoutStage(match.stage)) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <KnockoutRoundCardShell match={match} className={className} as={as}>
      {children}
    </KnockoutRoundCardShell>
  );
}
