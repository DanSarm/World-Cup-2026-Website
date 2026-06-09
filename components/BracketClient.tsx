"use client";

import { PageHeader } from "./PageHeader";
import { GroupStandingsPanel } from "./GroupStandingsPanel";
import { KnockoutBracketPanel } from "./KnockoutBracketPanel";
import type { Match, MatchPrediction } from "@/lib/types";

interface BracketClientProps {
  matches: Match[];
  predictions: MatchPrediction[];
}

export function BracketClient({ matches, predictions }: BracketClientProps) {
  const hasGroupStage = matches.some((m) => m.stage === "group");

  return (
    <div className="space-y-6">
      <PageHeader
        flags={["USA", "MEX", "CAN", "BRA"]}
        title="Bracket"
        subtitle="Your projected group standings from saved picks"
      />

      {hasGroupStage ? (
        <>
          <GroupStandingsPanel matches={matches} predictions={predictions} />
          <KnockoutBracketPanel matches={matches} predictions={predictions} />
        </>
      ) : (
        <div className="card text-center py-10 text-ink-muted text-sm">
          Group-stage matches aren&apos;t available yet
        </div>
      )}
    </div>
  );
}
