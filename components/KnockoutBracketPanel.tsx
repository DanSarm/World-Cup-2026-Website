"use client";

import { useMemo, useState } from "react";
import {
  BRACKET_TREE,
  buildKnockoutBracket,
  type BracketMatchView,
} from "@/lib/knockoutBracket";
import {
  buildPickScoreMap,
  type PickScore,
} from "@/lib/groupStandings";
import type { Match, MatchPrediction } from "@/lib/types";
import { hasSavedPick } from "@/lib/pickUtils";
import { TeamFlag } from "./Flag";
import { TeamCode } from "./TeamCode";

interface KnockoutBracketPanelProps {
  matches: Match[];
  predictions: MatchPrediction[];
}

export function KnockoutBracketPanel({
  matches,
  predictions,
}: KnockoutBracketPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const savedMap = useMemo(() => {
    const map = new Map<string, PickScore>();
    for (const p of predictions) {
      if (!hasSavedPick(p)) continue;
      map.set(p.match_id, {
        home: p.pred_home_score,
        away: p.pred_away_score,
      });
    }
    return map;
  }, [predictions]);

  const groupPickScores = useMemo(
    () => buildPickScoreMap(matches, savedMap, new Map()),
    [matches, savedMap]
  );

  const bracket = useMemo(
    () => buildKnockoutBracket(matches, groupPickScores, predictions),
    [matches, groupPickScores, predictions]
  );

  const getMatch = (n: number) => bracket.byNumber.get(n);
  const dbMatchByNumber = useMemo(
    () =>
      new Map(
        matches.filter((m) => m.match_number >= 73).map((m) => [m.match_number, m])
      ),
    [matches]
  );

  return (
    <section className="w-full space-y-3">
      <div className="card space-y-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-bold text-usa text-sm uppercase tracking-wide">
              Knockout bracket
            </h2>
            <p className="text-xs text-ink-muted leading-snug">
              Real scores advance teams when games finish · your knockout picks
              fill in games still to play
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-semibold text-ink-faint hover:text-ink shrink-0"
          >
            {expanded ? "Hide" : "Show"}
          </button>
        </div>

        {bracket.qualifyingThirdGroups.length > 0 && (
          <p className="text-[10px] text-ink-faint">
            Best third-place groups:{" "}
            <span className="font-semibold text-ink-muted">
              {bracket.qualifyingThirdGroups.join(", ")}
            </span>
          </p>
        )}
      </div>

      {expanded && (
        <div className="full-bleed">
          <p className="text-[10px] text-white/50 text-center mb-2 md:hidden">
            Swipe sideways to see the full bracket
          </p>
          <div className="knockout-bracket-scroll overflow-x-auto pb-2">
            <div className="bracket-tree">
              <BracketHalf
                side="left"
                rounds={[
                  { label: "Round of 32", matchNumbers: [...BRACKET_TREE.left.r32], span: 1 },
                  { label: "Round of 16", matchNumbers: [...BRACKET_TREE.left.r16], span: 2 },
                  { label: "Quarter-finals", matchNumbers: [...BRACKET_TREE.left.qf], span: 4 },
                  { label: "Semi-finals", matchNumbers: [...BRACKET_TREE.left.sf], span: 8 },
                ]}
                getMatch={getMatch}
                dbMatchByNumber={dbMatchByNumber}
              />

              <div className="bracket-center">
                <span className="bracket-round-label text-gold-dark">Final</span>
                <div className="bracket-center-matches">
                  {getMatch(BRACKET_TREE.center.final) && (
                    <BracketMatchCard
                      match={getMatch(BRACKET_TREE.center.final)!}
                      dbMatch={dbMatchByNumber.get(BRACKET_TREE.center.final)}
                      featured
                    />
                  )}
                  {getMatch(BRACKET_TREE.center.third) && (
                    <div className="space-y-1">
                      <span className="block text-[9px] font-bold uppercase tracking-wider text-ink-faint text-center">
                        3rd place
                      </span>
                      <BracketMatchCard
                        match={getMatch(BRACKET_TREE.center.third)!}
                        dbMatch={dbMatchByNumber.get(BRACKET_TREE.center.third)}
                      />
                    </div>
                  )}
                </div>
              </div>

              <BracketHalf
                side="right"
                rounds={[
                  { label: "Semi-finals", matchNumbers: [...BRACKET_TREE.right.sf], span: 8 },
                  { label: "Quarter-finals", matchNumbers: [...BRACKET_TREE.right.qf], span: 4 },
                  { label: "Round of 16", matchNumbers: [...BRACKET_TREE.right.r16], span: 2 },
                  { label: "Round of 32", matchNumbers: [...BRACKET_TREE.right.r32], span: 1 },
                ]}
                getMatch={getMatch}
                dbMatchByNumber={dbMatchByNumber}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

interface BracketRoundCol {
  label: string;
  matchNumbers: number[];
  span: number;
}

function BracketHalf({
  side,
  rounds,
  getMatch,
  dbMatchByNumber,
}: {
  side: "left" | "right";
  rounds: BracketRoundCol[];
  getMatch: (n: number) => BracketMatchView | undefined;
  dbMatchByNumber: Map<number, Match>;
}) {
  return (
    <div
      className={`bracket-half ${side === "right" ? "bracket-half--right" : "bracket-half--left"}`}
    >
      {rounds.map((round) => (
        <BracketRoundColumn
          key={`${side}-${round.label}`}
          label={round.label}
          matchNumbers={round.matchNumbers}
          rowSpan={round.span}
          side={side}
          getMatch={getMatch}
          dbMatchByNumber={dbMatchByNumber}
        />
      ))}
    </div>
  );
}

function BracketRoundColumn({
  label,
  matchNumbers,
  rowSpan,
  side,
  getMatch,
  dbMatchByNumber,
}: {
  label: string;
  matchNumbers: number[];
  rowSpan: number;
  side: "left" | "right";
  getMatch: (n: number) => BracketMatchView | undefined;
  dbMatchByNumber: Map<number, Match>;
}) {
  return (
    <div className={`bracket-round ${side === "right" ? "bracket-round--right" : ""}`}>
      <span className="bracket-round-label">{label}</span>
      <div className="bracket-round-grid">
        {matchNumbers.map((num, index) => {
          const match = getMatch(num);
          if (!match) return null;
          return (
            <div
              key={num}
              className="bracket-round-slot"
              style={{
                gridRow: `${index * rowSpan + 1} / span ${rowSpan}`,
              }}
            >
              <BracketMatchCard
                match={match}
                dbMatch={dbMatchByNumber.get(num)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BracketMatchCard({
  match,
  featured,
  dbMatch,
}: {
  match: BracketMatchView;
  featured?: boolean;
  dbMatch?: Match;
}) {
  const isLive = dbMatch?.status === "live";
  const showActual = match.isActualResult;

  return (
    <div
      className={`bracket-match rounded-lg border overflow-hidden ${
        featured
          ? "border-gold/50 bg-gradient-to-br from-gold/5 to-white ring-1 ring-gold/30"
          : "border-ink/10 bg-white"
      }`}
    >
      <div className="flex items-center justify-between px-1.5 py-0.5 bg-ink/[0.03] border-b border-ink/5">
        <span className="text-[8px] font-bold text-ink-faint uppercase tracking-wide">
          M{match.matchNumber}
        </span>
        <div className="flex items-center gap-1">
          {showActual && (
            <span
              className={`text-[8px] font-semibold uppercase ${
                isLive ? "text-canada" : "text-mexico"
              }`}
            >
              {isLive ? "Live" : "Final"}
            </span>
          )}
          {!showActual && match.hasPick && (
            <span className="text-[8px] font-semibold text-ink-faint">Pick</span>
          )}
        </div>
      </div>
      <BracketTeamRow
        slot={match.home}
        isWinner={match.winnerId === match.home.team?.teamId}
      />
      <div className="h-px bg-ink/8" />
      <BracketTeamRow
        slot={match.away}
        isWinner={match.winnerId === match.away.team?.teamId}
      />
    </div>
  );
}

function BracketTeamRow({
  slot,
  isWinner,
}: {
  slot: BracketMatchView["home"];
  isWinner: boolean;
}) {
  if (slot.team) {
    return (
      <div
        className={`flex items-center gap-1 px-1.5 py-1 min-h-[28px] ${
          isWinner ? "bg-gold/10 font-semibold" : ""
        }`}
      >
        <TeamFlag team={slot.team.team} size="xs" />
        <TeamCode
          code={slot.team.team.fifa_code}
          className={`flex-1 truncate text-xs tracking-normal ${
            isWinner ? "text-ink" : "text-ink-muted"
          }`}
        />
        {isWinner && (
          <span className="text-[8px] font-bold text-gold-dark uppercase shrink-0">
            W
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 px-1.5 py-1 min-h-[28px]">
      <span className="w-5 h-[15px] rounded-sm bg-ink/5 inline-flex items-center justify-center text-[9px] text-ink-faint">
        ?
      </span>
      <span className="text-[10px] text-ink-faint italic truncate">
        {slot.placeholder ?? "TBD"}
      </span>
    </div>
  );
}
