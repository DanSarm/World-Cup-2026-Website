import { isKnockoutStage, type Match } from "@/lib/types";

export function parseProb(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function hasMatchOdds(match: Match): boolean {
  return getMatchOddsSegments(match) != null;
}

export interface OddsSegment {
  key: "home" | "draw" | "away";
  label: string;
  pct: number;
  barClass: string;
  dotClass: string;
  textClass: string;
}

function shortTeamLabel(match: Match, side: "home" | "away"): string {
  const team = side === "home" ? match.home_team : match.away_team;
  const name = team?.short_name ?? (side === "home" ? match.home_label : match.away_label);
  return name.length > 12 ? name.slice(0, 10) + "…" : name;
}

function teamCodeLabel(match: Match, side: "home" | "away"): string {
  const team = side === "home" ? match.home_team : match.away_team;
  if (team?.fifa_code) return team.fifa_code;
  return shortTeamLabel(match, side);
}

function buildSegments(
  parts: Array<{
    key: OddsSegment["key"];
    label: string;
    prob: number | null;
    barClass: string;
    dotClass: string;
    textClass: string;
  }>
): OddsSegment[] | null {
  const withProb = parts
    .map((p) => ({ ...p, value: parseProb(p.prob) }))
    .filter((p) => p.value != null && p.value > 0) as Array<
    (typeof parts)[0] & { value: number }
  >;

  if (!withProb.length) return null;

  const total = withProb.reduce((s, p) => s + p.value, 0);
  if (total <= 0) return null;

  const raw = withProb.map((p) => ({
    key: p.key,
    label: p.label,
    barClass: p.barClass,
    dotClass: p.dotClass,
    textClass: p.textClass,
    exact: (p.value / total) * 100,
  }));

  const rounded = raw.map((r) => ({ ...r, pct: Math.round(r.exact) }));
  const drift = 100 - rounded.reduce((s, r) => s + r.pct, 0);
  if (drift !== 0 && rounded.length) {
    const idx = rounded.reduce(
      (best, r, i, arr) => (r.exact > arr[best].exact ? i : best),
      0
    );
    rounded[idx].pct += drift;
  }

  return rounded.map(({ key, label, pct, barClass, dotClass, textClass }) => ({
    key,
    label,
    pct,
    barClass,
    dotClass,
    textClass,
  }));
}

/** User-facing win-chance segments (percentages, not decimal odds). */
export function getMatchOddsSegments(match: Match): OddsSegment[] | null {
  if (isKnockoutStage(match.stage)) {
    return buildSegments([
      {
        key: "home",
        label: teamCodeLabel(match, "home"),
        prob: match.home_advance_probability,
        barClass: "bg-odds-home",
        dotClass: "bg-odds-home",
        textClass: "text-odds-home",
      },
      {
        key: "away",
        label: teamCodeLabel(match, "away"),
        prob: match.away_advance_probability,
        barClass: "bg-odds-away",
        dotClass: "bg-odds-away",
        textClass: "text-odds-away",
      },
    ]);
  }

  return buildSegments([
    {
      key: "home",
      label: teamCodeLabel(match, "home"),
      prob: match.home_implied_probability,
      barClass: "bg-odds-home",
      dotClass: "bg-odds-home",
      textClass: "text-odds-home",
    },
    {
      key: "draw",
      label: "Draw",
      prob: match.draw_implied_probability,
      barClass: "bg-ink-light",
      dotClass: "bg-ink-light",
      textClass: "text-ink-muted",
    },
    {
      key: "away",
      label: teamCodeLabel(match, "away"),
      prob: match.away_implied_probability,
      barClass: "bg-odds-away",
      dotClass: "bg-odds-away",
      textClass: "text-odds-away",
    },
  ]);
}

/** @deprecated use getMatchOddsSegments — kept for admin tooling */
export function impliedProbToDecimalOdds(prob: number | string | null | undefined): string | null {
  const n = parseProb(prob);
  if (n == null) return null;
  return (1 / n).toFixed(2);
}
