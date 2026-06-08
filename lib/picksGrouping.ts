import type { Match, MatchPrediction } from "./types";
import {
  getTodayTomorrowKeys,
  matchDateKey,
  formatDateHeader,
  canPickMatch,
  isMatchLocked,
} from "./utils";

export interface PicksSection {
  id: string;
  title: string;
  subtitle?: string;
  matches: Match[];
}

export function groupMatchesForPicks(matches: Match[]): PicksSection[] {
  const { today, tomorrow } = getTodayTomorrowKeys();
  const sections: PicksSection[] = [];
  const used = new Set<string>();

  const todayMatches = matches.filter(
    (m) => matchDateKey(m.kickoff_at) === today
  );
  if (todayMatches.length) {
    sections.push({ id: "today", title: "Today", matches: todayMatches });
    todayMatches.forEach((m) => used.add(m.id));
  }

  const tomorrowMatches = matches.filter(
    (m) => matchDateKey(m.kickoff_at) === tomorrow
  );
  if (tomorrowMatches.length) {
    sections.push({
      id: "tomorrow",
      title: "Tomorrow",
      matches: tomorrowMatches,
    });
    tomorrowMatches.forEach((m) => used.add(m.id));
  }

  const byDate = new Map<string, Match[]>();
  for (const m of matches) {
    if (used.has(m.id)) continue;
    const key = matchDateKey(m.kickoff_at);
    const list = byDate.get(key) ?? [];
    list.push(m);
    byDate.set(key, list);
  }

  const sortedDates = [...byDate.keys()].sort((a, b) => {
    if (a === "tba") return 1;
    if (b === "tba") return -1;
    return a.localeCompare(b);
  });

  for (const dateKey of sortedDates) {
    const dateMatches = byDate.get(dateKey) ?? [];
    if (!dateMatches.length) continue;

    const groupStage = dateMatches.filter((m) => m.stage === "group");
    const knockout = dateMatches.filter((m) => m.stage !== "group");

    if (groupStage.length) {
      sections.push({
        id: `date-${dateKey}-group`,
        title:
          dateKey === "tba"
            ? "Group Stage · Time TBA"
            : formatDateHeader(groupStage[0]?.kickoff_at ?? null),
        subtitle: groupStage.length > 1 ? `${groupStage.length} matches` : undefined,
        matches: groupStage,
      });
    }

    if (knockout.length) {
      const stageTitle =
        dateKey === "tba"
          ? "Knockout · Time TBA"
          : formatDateHeader(knockout[0]?.kickoff_at ?? null);
      sections.push({
        id: `date-${dateKey}-ko`,
        title: knockout.length && !groupStage.length ? stageTitle : `${stageTitle} · Knockout`,
        matches: knockout,
      });
    }
  }

  return sections;
}

export type PicksFilter = "all" | "need" | "saved" | "open";

export function filterSections(
  sections: PicksSection[],
  filter: PicksFilter,
  predMap: Map<string, MatchPrediction>
): PicksSection[] {
  if (filter === "all") return sections;

  return sections
    .map((section) => ({
      ...section,
      matches: section.matches.filter((m) => {
        const hasPick = predMap.has(m.id);
        const pickable = canPickMatch(m);
        const locked = isMatchLocked(m);

        if (filter === "need") return pickable && !hasPick;
        if (filter === "saved") return hasPick;
        if (filter === "open") return pickable;
        return true;
      }),
    }))
    .filter((s) => s.matches.length > 0);
}

export function picksProgress(
  matches: Match[],
  predMap: Map<string, MatchPrediction>
): {
  saved: number;
  pickable: number;
  total: number;
  locked: number;
} {
  const pickableMatches = matches.filter(
    (m) => m.home_team_id && m.away_team_id
  );
  const openMatches = pickableMatches.filter((m) => canPickMatch(m));
  const saved = openMatches.filter((m) => predMap.has(m.id)).length;
  const locked = pickableMatches.filter((m) => isMatchLocked(m)).length;

  return {
    saved: predMap.size,
    pickable: openMatches.length,
    total: matches.length,
    locked,
  };
}
