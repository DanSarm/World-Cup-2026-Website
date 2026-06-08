import type { Team } from "@/lib/types";

/** FIFA code → common sportsbook name variants. */
export const TEAM_ALIASES: Record<string, string[]> = {
  USA: ["United States", "USMNT", "United States of America", "USA"],
  KOR: ["South Korea", "Republic of Korea", "Korea Republic", "Korea"],
  IRN: ["Iran", "IR Iran"],
  TUR: ["Turkey", "Türkiye", "Turkiye"],
  CZE: ["Czech Republic", "Czechia"],
  CPV: ["Cape Verde", "Cabo Verde"],
  COD: ["DR Congo", "Democratic Republic of Congo", "Congo DR", "Congo"],
  CIV: ["Ivory Coast", "Côte d'Ivoire", "Cote d'Ivoire"],
  ENG: ["England"],
  SCO: ["Scotland"],
  NED: ["Netherlands", "Holland"],
  GER: ["Germany"],
  BRA: ["Brazil"],
  ARG: ["Argentina"],
  FRA: ["France"],
  MEX: ["Mexico"],
  CAN: ["Canada"],
  UZB: ["Uzbekistan"],
  RSA: ["South Africa", "S. Africa"],
  BIH: ["Bosnia and Herzegovina", "Bosnia"],
  CUW: ["Curaçao", "Curacao"],
  NZL: ["New Zealand"],
};

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function namesForTeam(team: Pick<Team, "name" | "short_name" | "fifa_code">): string[] {
  const aliases = TEAM_ALIASES[team.fifa_code] ?? [];
  return [team.name, team.short_name, ...aliases].map(normalizeName);
}

export function teamNameMatches(candidate: string, team: Pick<Team, "name" | "short_name" | "fifa_code">): boolean {
  const norm = normalizeName(candidate);
  if (!norm) return false;
  const variants = namesForTeam(team);
  return variants.some(
    (v) => v === norm || v.includes(norm) || norm.includes(v)
  );
}
