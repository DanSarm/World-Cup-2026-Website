import type { CommunityMatchPick } from "@/lib/data";
import {
  previewPickRewards,
  DEFAULT_SCORING_CONFIG,
  type ScoringConfig,
} from "@/lib/scoringConfig";
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

function maxPointsIfCorrect(
  match: Match,
  pick: CommunityMatchPick,
  scoringConfig: ScoringConfig
): number | null {
  if (match.status === "final") return null;

  const isKO = isKnockoutStage(match.stage);
  const isTie = pick.predHomeScore === pick.predAwayScore;
  if (isKO && isTie && !pick.predWinnerTeamId) return null;

  return previewPickRewards(
    match,
    pick.predHomeScore,
    pick.predAwayScore,
    scoringConfig,
    pick.predWinnerTeamId
  ).maxPoints;
}

export function MatchCommunityPicks({
  match,
  picks,
  currentPlayerId,
  embedded = false,
  scoringConfig = DEFAULT_SCORING_CONFIG,
}: {
  match: Match;
  picks: CommunityMatchPick[];
  currentPlayerId: string;
  embedded?: boolean;
  scoringConfig?: ScoringConfig;
}) {
  const sortedPicks = [...picks].sort((a, b) => {
    const aPts = maxPointsIfCorrect(match, a, scoringConfig) ?? -1;
    const bPts = maxPointsIfCorrect(match, b, scoringConfig) ?? -1;
    if (bPts !== aPts) return bPts - aPts;
    return a.displayName.localeCompare(b.displayName);
  });

  const content = (
    <>
      {sortedPicks.length === 0 ? (
        <p className="text-center text-sm text-ink-faint py-6 px-4">
          No picks yet — be the first!
        </p>
      ) : (
        sortedPicks.map((pick) => {
          const isYou = pick.playerId === currentPlayerId;
          const maxPts = maxPointsIfCorrect(match, pick, scoringConfig);
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
              <span className="shrink-0 text-right leading-tight">
                <span className="font-extrabold text-ink tabular-nums">
                  {formatPickScore(pick, match)}
                </span>
                {maxPts != null && (
                  <span className="block text-[10px] font-medium text-ink-faint tabular-nums mt-0.5">
                    +{maxPts} if correct
                  </span>
                )}
              </span>
            </div>
          );
        })
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="border-t border-ink/8 bg-cream/20">
        <div className="px-4 py-3 border-b border-ink/5">
          <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wide">
            Everyone&apos;s picks
          </h3>
        </div>
        {content}
      </div>
    );
  }

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
      {content}
    </div>
  );
}
