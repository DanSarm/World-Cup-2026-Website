/** Odds API configuration (server-only). */

export function getOddsConfig() {
  return {
    apiKey: process.env.ODDS_API_KEY ?? "",
    provider: process.env.ODDS_API_PROVIDER ?? "the_odds_api",
    regions: process.env.ODDS_REGIONS ?? "us,uk,eu",
    markets: process.env.ODDS_MARKETS ?? "h2h",
    oddsFormat: process.env.ODDS_FORMAT ?? "decimal",
    lockHoursBeforeKickoff: Number(process.env.ODDS_LOCK_HOURS_BEFORE_KICKOFF ?? "1"),
    sportKey: process.env.ODDS_SPORT_KEY ?? "soccer_fifa_world_cup",
    cronSecret: process.env.CRON_SECRET ?? "",
  };
}

export function isOddsApiConfigured(): boolean {
  return Boolean(process.env.ODDS_API_KEY?.trim());
}
