"use client";

import { useMemo } from "react";
import { PageHeader } from "./PageHeader";
import { GroupStandingsPanel } from "./GroupStandingsPanel";
import { ThirdPlaceTablePanel } from "./ThirdPlaceTablePanel";
import { KnockoutBracketPanel } from "./KnockoutBracketPanel";
import { mergeMatchScoreUpdates } from "@/lib/matchLive";
import { useLiveRefresh } from "@/lib/hooks/useLiveRefresh";
import type { Match, MatchPrediction } from "@/lib/types";

interface BracketClientProps {
  matches: Match[];
  predictions: MatchPrediction[];
  pollLive?: boolean;
}

export function BracketClient({
  matches: initialMatches,
  predictions,
  pollLive = false,
}: BracketClientProps) {
  const { data } = useLiveRefresh(pollLive);

  const matches = useMemo(
    () => mergeMatchScoreUpdates(initialMatches, data?.matches ?? []),
    [initialMatches, data?.matches]
  );

  const hasGroupStage = matches.some((m) => m.stage === "group");

  return (
    <div className="space-y-6">
      <PageHeader
        flags={["USA", "MEX", "CAN", "BRA"]}
        title="Bracket"
      />

      {hasGroupStage ? (
        <>
          <GroupStandingsPanel matches={matches} predictions={predictions} />
          <ThirdPlaceTablePanel matches={matches} predictions={predictions} />
          <KnockoutBracketPanel matches={matches} predictions={predictions} />
        </>
      ) : (
        <div className="card text-center py-10 text-ink-muted text-sm">
          Coming soon
        </div>
      )}
    </div>
  );
}
