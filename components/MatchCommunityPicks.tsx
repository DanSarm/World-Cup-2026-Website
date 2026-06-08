import type { CommunityMatchPick } from "@/lib/data";
import type { Match } from "@/lib/types";
import { isKnockoutStage } from "@/lib/types";

function formatPickScore(
  pick: CommunityMatchPick,
  match: Match
): string {
  const score = `${pick.predHomeScore}–${pick.predAwayScore}`;
  const isTie = pick.predHomeScore === pick.predAwayScore;
  const isKO = isKnockoutStage(match.stage);

  if (!isKO || !isTie || !pick.predWinnerTeamId) {
    return score;
  }

  const code =
    pick.predWinnerTeamId === match.home_team_id
      ? match.home_team?.fifa_code
      : pick.predWinnerTeamId === match.away_team_id
        ? match.away_team?.fifa_code
        : null;

  return code ? `${score} · ${code}` : score;
}

export function MatchCommunityPicks({
  match,
  picks,
  currentPlayerId,
}: {
  match: Match;
  picks: CommunityMatchPick[];
  currentPlayerId: string;
}) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-ink/5">
        <h3 className="text-sm font-bold text-usa uppercase tracking-wide">
          Everyone&apos;s picks
        </h3>
        <p className="text-xs text-ink-muted mt-0.5">
          What the group is predicting for this match
        </p>
      </div>

      {picks.length === 0 ? (
        <p className="text-center text-sm text-ink-faint py-6 px-4">
          No picks yet — be the first!
        </p>
      ) : (
        picks.map((pick) => {
          const isYou = pick.playerId === currentPlayerId;
          return (
            <div
              key={pick.playerId}
              className={`lb-row ${isYou ? "bg-usa/5" : ""}`}
            >
              <span className="w-7 text-center shrink-0 text-base">
                {pick.avatarEmoji}
              </span>
              <span className="flex-1 min-w-0 font-semibold text-ink truncate">
                {pick.displayName}
                {isYou && (
                  <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-usa">
                    You
                  </span>
                )}
              </span>
              <span className="font-extrabold text-ink tabular-nums shrink-0">
                {formatPickScore(pick, match)}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
