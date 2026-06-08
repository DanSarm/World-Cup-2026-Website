import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf8");
function getEnv(key: string): string {
  const line = envText.split("\n").find((l) => l.startsWith(key + "="));
  if (!line) return "";
  let val = line.slice(key.length + 1).trim();
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  return val;
}

async function main() {
const sb = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));

const { data: sample, error } = await sb
  .from("matches")
  .select("match_number,home_win_bonus,home_team_id,kickoff_at")
  .order("match_number")
  .limit(3);
console.log("basic columns error:", error);
console.log("basic sample:", JSON.stringify(sample, null, 2));

const { data: sample2, error: error2 } = await sb
  .from("matches")
  .select(
    "match_number,odds_status,home_implied_probability,draw_implied_probability,away_implied_probability,home_win_bonus,home_team_id,odds_source_note,kickoff_at"
  )
  .order("match_number")
  .limit(8);

console.log("error:", error);
console.log("sample:", JSON.stringify(sample, null, 2));

const { data: all } = await sb.from("matches").select("odds_status, home_implied_probability");
const counts: Record<string, number> = {};
let withProb = 0;
for (const r of all ?? []) {
  counts[r.odds_status ?? "null"] = (counts[r.odds_status ?? "null"] ?? 0) + 1;
  if (r.home_implied_probability != null) withProb++;
}
console.log("odds_status counts:", counts);
console.log("matches with home_implied_probability:", withProb);

const key = getEnv("ODDS_API_KEY");
const sportsRes = await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${key}`);
const sports = (await sportsRes.json()) as { key: string; title: string; active: boolean }[];
const wc = sports.filter((s) => /world|fifa/i.test(s.title + s.key));
console.log(
  "active WC sports:",
  wc.map((s) => ({ key: s.key, title: s.title, active: s.active }))
);

for (const s of wc.filter((x) => x.active).slice(0, 2)) {
  const url = `https://api.the-odds-api.com/v4/sports/${s.key}/odds/?apiKey=${key}&regions=us,uk,eu&markets=h2h&oddsFormat=decimal`;
  const res = await fetch(url);
  const events = res.ok ? await res.json() : [];
  console.log(`${s.key}: ${res.status}, events=${Array.isArray(events) ? events.length : 0}`);
  if (Array.isArray(events) && events[0]) {
    console.log("  first:", events[0].home_team, "vs", events[0].away_team, events[0].commence_time);
  }
}
}

main().catch(console.error);
