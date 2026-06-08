import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getLeaderboardData, getMatchesWithTeams } from "@/lib/data";
import { calculatePot } from "@/lib/payouts";
import { PrizeCard } from "@/components/PrizeCard";
import { PageHeader } from "@/components/PageHeader";
import { formatKickoff } from "@/lib/utils";
import type { Match } from "@/lib/types";
import { TeamFlag } from "@/components/Flag";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [{ leaderboard, settings, players }, matches] = await Promise.all([
    getLeaderboardData(),
    getMatchesWithTeams(),
  ]);

  const me = leaderboard.find((e) => e.playerId === session.id);
  const paidCount = players.filter((p) => p.paid).length;
  const pot = calculatePot(settings.buy_in, paidCount);
  const top5 = leaderboard.slice(0, 5);

  const upcoming = matches
    .filter((m) => m.status !== "final")
    .sort((a, b) => (a.kickoff_at ?? "9999").localeCompare(b.kickoff_at ?? "9999"))
    .slice(0, 3);

  const missingKickoffs = matches.some((m) => !m.kickoff_at);

  return (
    <div className="space-y-6">
      <PageHeader
        logo
        title="Family Cup 2026"
        subtitle="Pick scores. Win points. · Every game counts."
      />

      {missingKickoffs && session.is_admin && (
        <div className="alert-warning">
          ⚠️ Kickoff times missing — add times before launch
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <PrizeCard icon="💰" label="Prize Pot" value={pot} highlight />
        <PrizeCard icon="⭐" label="My Points" value={String(me?.totalPoints ?? 0)} />
        <PrizeCard
          icon="🏆"
          label={settings.tournament_complete ? "My Won" : "Projected Prize"}
          value={me?.projectedPrize ?? 0}
        />
        <PrizeCard icon="🎯" label="Exact Scores" value={String(me?.exactScores ?? 0)} />
      </div>

      <div className="flex justify-center">
        <span
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold ${
            session.paid
              ? "bg-mexico/15 text-mexico border border-mexico/30"
              : "bg-gold/15 text-gold-light border border-gold/30"
          }`}
        >
          {session.paid ? "✅ Paid" : "💳 Need to Pay"}
        </span>
      </div>

      <Link href="/picks" className="btn-gold">
        ⚽ Make Picks
      </Link>

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-title px-0.5">Next Up</h2>
          <div className="space-y-2">
            {upcoming.map((m) => (
              <MiniMatch key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="section-title">Top 5</h2>
          <Link
            href="/leaderboard"
            className="text-xs font-semibold text-gold-light hover:text-gold transition-colors"
          >
            See all →
          </Link>
        </div>
        <div className="card p-0 overflow-hidden">
          {top5.map((entry) => (
            <div key={entry.playerId} className="lb-row">
              <span className="w-7 text-center font-bold text-ink-faint text-sm">
                {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank}
              </span>
              <span className="flex-1 font-semibold text-ink truncate">
                {entry.avatarEmoji} {entry.displayName}
              </span>
              <span className="font-extrabold text-usa tabular-nums">
                {entry.totalPoints}
                <span className="text-xs font-normal text-ink-faint ml-0.5">pts</span>
              </span>
            </div>
          ))}
          {top5.length === 0 && (
            <p className="text-center text-ink-faint py-6 text-sm">No players yet</p>
          )}
        </div>
      </section>
    </div>
  );
}

function MiniMatch({ match }: { match: Match }) {
  return (
    <div className="card py-3.5 px-4 flex items-center gap-3">
      <div className="flex gap-1.5 shrink-0">
        <TeamFlag team={match.home_team} size="md" />
        <TeamFlag team={match.away_team} size="md" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink truncate">
          {match.home_label} vs {match.away_label}
        </p>
        <p className="text-xs text-ink-faint">{formatKickoff(match.kickoff_at)}</p>
      </div>
    </div>
  );
}
