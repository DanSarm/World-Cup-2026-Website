import { resolve } from "path";

async function main() {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });

  const key = process.env.ODDS_API_KEY;
  console.log("ODDS_API_KEY set:", Boolean(key?.trim()));

  const winnerKey =
    process.env.ODDS_WINNER_SPORT_KEY ?? "soccer_fifa_world_cup_winner";

  const sportsRes = await fetch(
    `https://api.the-odds-api.com/v4/sports/?apiKey=${key}`
  );
  const sports = (await sportsRes.json()) as {
    key: string;
    title: string;
    active: boolean;
  }[];
  const wc = sports.filter((s) => /world|fifa|winner/i.test(s.title + s.key));
  console.log(
    "WC sports:",
    wc.map((s) => ({ key: s.key, title: s.title, active: s.active }))
  );

  for (const sk of [winnerKey, "soccer_fifa_world_cup_winner"]) {
    for (const markets of ["outrights", "h2h"]) {
      for (const regions of ["us", "us,uk,eu"]) {
        const url = `https://api.the-odds-api.com/v4/sports/${sk}/odds/?apiKey=${key}&regions=${regions}&markets=${markets}&oddsFormat=decimal`;
        const res = await fetch(url);
        const body = res.ok ? await res.json() : await res.text();
        const n = Array.isArray(body) ? body.length : 0;
        console.log(`${sk} ${markets} ${regions} → ${res.status} events=${n}`);
        if (Array.isArray(body) && body[0]) {
          const e = body[0] as {
            bookmakers?: Array<{
              key: string;
              markets?: Array<{
                key: string;
                outcomes?: Array<{ name: string; price: number }>;
              }>;
            }>;
          };
          for (const bm of e.bookmakers?.slice(0, 2) ?? []) {
            for (const m of bm.markets ?? []) {
              console.log(
                `  ${bm.key}/${m.key}:`,
                m.outcomes?.slice(0, 5).map((o) => `${o.name}@${o.price}`)
              );
            }
          }
        } else if (!res.ok) {
          console.log("  error:", String(body).slice(0, 200));
        }
      }
    }
  }

  const { getTeams } = await import("../lib/data");
  const { processWorldCupWinnerOdds } = await import("../lib/odds/championOdds");
  const { fetchWorldCupWinnerOdds } = await import("../lib/odds/theOddsApi");

  const teams = await getTeams();
  try {
    const events = await fetchWorldCupWinnerOdds();
    console.log("fetchWorldCupWinnerOdds events:", events.length);
    const ranked = processWorldCupWinnerOdds(events, teams);
    console.log("matched teams:", ranked.length);
    console.log("top 5:", ranked.slice(0, 5).map((r) => `${r.team.fifa_code} ${(r.impliedProbability * 100).toFixed(1)}%`));
    if (ranked.length === 0 && events[0]) {
      const outcomes = new Set<string>();
      for (const bm of events[0].bookmakers ?? []) {
        for (const m of bm.markets ?? []) {
          for (const o of m.outcomes ?? []) outcomes.add(o.name);
        }
      }
      console.log("unmatched outcome names (sample):", [...outcomes].slice(0, 15));
    }
  } catch (err) {
    console.error("fetchWorldCupWinnerOdds failed:", err);
  }
}

main().catch(console.error);
