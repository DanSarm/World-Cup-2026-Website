import type { Team } from "./types";

/** All 48 World Cup 2026 teams — always available for UI even if DB is empty. */
export const WORLD_CUP_TEAMS: Omit<Team, "id">[] = [
  { name: "Mexico", short_name: "Mexico", fifa_code: "MEX", flag_emoji: "🇲🇽", group_letter: "A" },
  { name: "South Africa", short_name: "S. Africa", fifa_code: "RSA", flag_emoji: "🇿🇦", group_letter: "A" },
  { name: "Korea Republic", short_name: "Korea", fifa_code: "KOR", flag_emoji: "🇰🇷", group_letter: "A" },
  { name: "Czechia", short_name: "Czechia", fifa_code: "CZE", flag_emoji: "🇨🇿", group_letter: "A" },
  { name: "Canada", short_name: "Canada", fifa_code: "CAN", flag_emoji: "🇨🇦", group_letter: "B" },
  { name: "Bosnia and Herzegovina", short_name: "Bosnia", fifa_code: "BIH", flag_emoji: "🇧🇦", group_letter: "B" },
  { name: "Qatar", short_name: "Qatar", fifa_code: "QAT", flag_emoji: "🇶🇦", group_letter: "B" },
  { name: "Switzerland", short_name: "Switzerland", fifa_code: "SUI", flag_emoji: "🇨🇭", group_letter: "B" },
  { name: "Brazil", short_name: "Brazil", fifa_code: "BRA", flag_emoji: "🇧🇷", group_letter: "C" },
  { name: "Morocco", short_name: "Morocco", fifa_code: "MAR", flag_emoji: "🇲🇦", group_letter: "C" },
  { name: "Haiti", short_name: "Haiti", fifa_code: "HAI", flag_emoji: "🇭🇹", group_letter: "C" },
  { name: "Scotland", short_name: "Scotland", fifa_code: "SCO", flag_emoji: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", group_letter: "C" },
  { name: "USA", short_name: "USA", fifa_code: "USA", flag_emoji: "🇺🇸", group_letter: "D" },
  { name: "Paraguay", short_name: "Paraguay", fifa_code: "PAR", flag_emoji: "🇵🇾", group_letter: "D" },
  { name: "Australia", short_name: "Australia", fifa_code: "AUS", flag_emoji: "🇦🇺", group_letter: "D" },
  { name: "Türkiye", short_name: "Türkiye", fifa_code: "TUR", flag_emoji: "🇹🇷", group_letter: "D" },
  { name: "Germany", short_name: "Germany", fifa_code: "GER", flag_emoji: "🇩🇪", group_letter: "E" },
  { name: "Curaçao", short_name: "Curaçao", fifa_code: "CUW", flag_emoji: "🇨🇼", group_letter: "E" },
  { name: "Côte d'Ivoire", short_name: "Ivory Coast", fifa_code: "CIV", flag_emoji: "🇨🇮", group_letter: "E" },
  { name: "Ecuador", short_name: "Ecuador", fifa_code: "ECU", flag_emoji: "🇪🇨", group_letter: "E" },
  { name: "Netherlands", short_name: "Netherlands", fifa_code: "NED", flag_emoji: "🇳🇱", group_letter: "F" },
  { name: "Japan", short_name: "Japan", fifa_code: "JPN", flag_emoji: "🇯🇵", group_letter: "F" },
  { name: "Sweden", short_name: "Sweden", fifa_code: "SWE", flag_emoji: "🇸🇪", group_letter: "F" },
  { name: "Tunisia", short_name: "Tunisia", fifa_code: "TUN", flag_emoji: "🇹🇳", group_letter: "F" },
  { name: "Belgium", short_name: "Belgium", fifa_code: "BEL", flag_emoji: "🇧🇪", group_letter: "G" },
  { name: "Egypt", short_name: "Egypt", fifa_code: "EGY", flag_emoji: "🇪🇬", group_letter: "G" },
  { name: "IR Iran", short_name: "Iran", fifa_code: "IRN", flag_emoji: "🇮🇷", group_letter: "G" },
  { name: "New Zealand", short_name: "New Zealand", fifa_code: "NZL", flag_emoji: "🇳🇿", group_letter: "G" },
  { name: "Spain", short_name: "Spain", fifa_code: "ESP", flag_emoji: "🇪🇸", group_letter: "H" },
  { name: "Cabo Verde", short_name: "Cabo Verde", fifa_code: "CPV", flag_emoji: "🇨🇻", group_letter: "H" },
  { name: "Saudi Arabia", short_name: "Saudi Arabia", fifa_code: "KSA", flag_emoji: "🇸🇦", group_letter: "H" },
  { name: "Uruguay", short_name: "Uruguay", fifa_code: "URU", flag_emoji: "🇺🇾", group_letter: "H" },
  { name: "France", short_name: "France", fifa_code: "FRA", flag_emoji: "🇫🇷", group_letter: "I" },
  { name: "Senegal", short_name: "Senegal", fifa_code: "SEN", flag_emoji: "🇸🇳", group_letter: "I" },
  { name: "Iraq", short_name: "Iraq", fifa_code: "IRQ", flag_emoji: "🇮🇶", group_letter: "I" },
  { name: "Norway", short_name: "Norway", fifa_code: "NOR", flag_emoji: "🇳🇴", group_letter: "I" },
  { name: "Argentina", short_name: "Argentina", fifa_code: "ARG", flag_emoji: "🇦🇷", group_letter: "J" },
  { name: "Algeria", short_name: "Algeria", fifa_code: "ALG", flag_emoji: "🇩🇿", group_letter: "J" },
  { name: "Austria", short_name: "Austria", fifa_code: "AUT", flag_emoji: "🇦🇹", group_letter: "J" },
  { name: "Jordan", short_name: "Jordan", fifa_code: "JOR", flag_emoji: "🇯🇴", group_letter: "J" },
  { name: "Portugal", short_name: "Portugal", fifa_code: "POR", flag_emoji: "🇵🇹", group_letter: "K" },
  { name: "Congo DR", short_name: "Congo DR", fifa_code: "COD", flag_emoji: "🇨🇩", group_letter: "K" },
  { name: "Uzbekistan", short_name: "Uzbekistan", fifa_code: "UZB", flag_emoji: "🇺🇿", group_letter: "K" },
  { name: "Colombia", short_name: "Colombia", fifa_code: "COL", flag_emoji: "🇨🇴", group_letter: "K" },
  { name: "England", short_name: "England", fifa_code: "ENG", flag_emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group_letter: "L" },
  { name: "Croatia", short_name: "Croatia", fifa_code: "CRO", flag_emoji: "🇭🇷", group_letter: "L" },
  { name: "Ghana", short_name: "Ghana", fifa_code: "GHA", flag_emoji: "🇬🇭", group_letter: "L" },
  { name: "Panama", short_name: "Panama", fifa_code: "PAN", flag_emoji: "🇵🇦", group_letter: "L" },
];

export type TeamOption = Omit<Team, "id"> & { id?: string };

export function sortTeams(teams: TeamOption[]): TeamOption[] {
  return [...teams].sort((a, b) => {
    const ga = a.group_letter ?? "Z";
    const gb = b.group_letter ?? "Z";
    if (ga !== gb) return ga.localeCompare(gb);
    return a.name.localeCompare(b.name);
  });
}

export function getTeamByCode(code: string): Omit<Team, "id"> | undefined {
  return WORLD_CUP_TEAMS.find((t) => t.fifa_code === code);
}

export function teamsForPicker(): TeamOption[] {
  return sortTeams(WORLD_CUP_TEAMS);
}
