"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { LeaderboardProgression } from "@/lib/leaderboardProgression";

export interface LeaderboardProgressionChartProps {
  progression: LeaderboardProgression;
  variant?: "profile" | "pool";
  title?: string;
  highlightPlayerId?: string;
  size?: "default" | "large";
}

const SIZES = {
  default: { w: 400, h: 220 },
  large: { w: 580, h: 780 },
} as const;

const PAD_PROFILE = { top: 22, right: 44, bottom: 38, left: 44 };
const PAD_POOL = { top: 28, right: 88, bottom: 42, left: 48 };
const YOU_COLOR = "#002868";
const LABEL_MIN_GAP = 14;
const MIN_VISIBLE_SNAPSHOTS = 2;

/** Distinct hues for multi-player pool chart — spaced for easy telling apart. */
const POOL_LINE_COLORS = [
  "#C41E3A",
  "#006847",
  "#1D4ED8",
  "#D97706",
  "#7C3AED",
  "#0E7490",
  "#BE185D",
  "#4D7C0F",
  "#EA580C",
  "#4338CA",
  "#0F766E",
  "#A21CAF",
  "#B45309",
  "#2563EB",
  "#15803D",
  "#DC2626",
] as const;

function seriesForPlayer(
  snapshots: LeaderboardProgression["snapshots"],
  playerId: string
) {
  return snapshots.map((snap) => {
    const entry = snap.entries.find((e) => e.playerId === playerId);
    return {
      points: entry?.points ?? 0,
      rank: entry?.rank ?? snap.entries.length,
    };
  });
}

function niceStep(max: number, targetTicks = 4): number {
  if (max <= 0) return 1;
  const rough = max / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / magnitude;
  const step =
    residual >= 5 ? 5 * magnitude : residual >= 2 ? 2 * magnitude : magnitude;
  return Math.max(step, 1);
}

function formatPointsTick(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}

function playerColor(index: number, total: number, forPool: boolean): string {
  if (forPool) {
    return POOL_LINE_COLORS[index % POOL_LINE_COLORS.length];
  }
  const hue = Math.round((index * 360) / Math.max(total, 1));
  return `hsl(${hue} 58% 42%)`;
}

function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

function formatRankLabel(rank: number): string {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `#${rank}`;
}

function layoutEndLabels(
  items: Array<{ id: string; y: number }>,
  minY: number,
  maxY: number,
  minGap: number
): Map<string, number> {
  if (items.length === 0) return new Map();

  const sorted = [...items].sort((a, b) => a.y - b.y);
  const ys: number[] = [];

  for (let i = 0; i < sorted.length; i++) {
    let y = sorted[i].y;
    if (i > 0 && y - ys[i - 1] < minGap) {
      y = ys[i - 1] + minGap;
    }
    ys.push(y);
  }

  const bottomOverflow = ys[ys.length - 1] - maxY;
  if (bottomOverflow > 0) {
    for (let i = 0; i < ys.length; i++) ys[i] -= bottomOverflow;
  }

  const topOverflow = minY - ys[0];
  if (topOverflow > 0) {
    for (let i = 0; i < ys.length; i++) ys[i] += topOverflow;
  }

  return new Map(sorted.map((item, i) => [item.id, ys[i]]));
}

export function LeaderboardProgressionChart({
  progression,
  variant = "profile",
  title,
  highlightPlayerId,
  size = "default",
}: LeaderboardProgressionChartProps) {
  const uid = useId().replace(/:/g, "");
  const snapshots = progression.snapshots;
  const { w: CHART_W, h: CHART_H } = SIZES[size];
  const isPool = variant === "pool";
  const pad = isPool ? PAD_POOL : PAD_PROFILE;
  const [snapshotStart, setSnapshotStart] = useState(0);

  const playerList = useMemo(() => {
    const last = snapshots[snapshots.length - 1];
    if (!last) return [];
    return [...last.entries].sort((a, b) => b.points - a.points);
  }, [snapshots]);

  const maxSnapshotStart = Math.max(0, snapshots.length - MIN_VISIBLE_SNAPSHOTS);

  useEffect(() => {
    setSnapshotStart(0);
  }, [snapshots, highlightPlayerId, isPool]);

  useEffect(() => {
    setSnapshotStart((start) => Math.min(start, maxSnapshotStart));
  }, [maxSnapshotStart]);

  const chart = useMemo(() => {
    if (snapshots.length < MIN_VISIBLE_SNAPSHOTS) return null;

    const visibleSnapshots = isPool
      ? snapshots.slice(
          Math.min(snapshotStart, maxSnapshotStart),
          snapshots.length
        )
      : snapshots;

    if (visibleSnapshots.length < MIN_VISIBLE_SNAPSHOTS) return null;

    const plotW = CHART_W - pad.left - pad.right;
    const plotH = CHART_H - pad.top - pad.bottom;
    const xStep = plotW / (visibleSnapshots.length - 1);

    const players =
      isPool && highlightPlayerId
        ? playerList
        : isPool
          ? playerList
          : highlightPlayerId
            ? [{ playerId: highlightPlayerId, displayName: "", points: 0, rank: 0 }]
            : [];

    const playerSeries = (isPool ? playerList : players).map((player, index) => {
      const data = seriesForPlayer(visibleSnapshots, player.playerId);
      return { ...player, data, color: playerColor(index, playerList.length, isPool) };
    });

    if (!isPool && highlightPlayerId) {
      const data = seriesForPlayer(visibleSnapshots, highlightPlayerId);
      playerSeries.length = 0;
      playerSeries.push({
        playerId: highlightPlayerId,
        displayName: "",
        points: 0,
        rank: 0,
        data,
        color: "#002868",
      });
    }

    let maxPoints = 1;
    let minPoints = Infinity;
    let maxRank = 1;
    for (const snap of visibleSnapshots) {
      for (const entry of snap.entries) {
        maxPoints = Math.max(maxPoints, entry.points);
        minPoints = Math.min(minPoints, entry.points);
      }
    }
    for (const p of playerSeries) {
      for (const d of p.data) {
        maxRank = Math.max(maxRank, d.rank);
      }
    }
    if (!Number.isFinite(minPoints)) minPoints = 0;

    const pointsCeil = isPool
      ? maxPoints
      : Math.ceil(maxPoints / niceStep(maxPoints)) * niceStep(maxPoints);
    const pointsFloor = isPool ? minPoints : 0;
    const pointsSpan = Math.max(pointsCeil - pointsFloor, 1);

    const xAt = (index: number) => pad.left + index * xStep;
    const yPoints = (points: number) =>
      pad.top +
      plotH -
      ((points - pointsFloor) / pointsSpan) * plotH;
    const yRank = (rank: number) =>
      pad.top + ((rank - 1) / Math.max(maxRank - 1, 1)) * plotH;
    const baselineY = pad.top + plotH;

    const series = playerSeries.map((player) => {
      const pointsLine = player.data
        .map(
          (d, i) =>
            `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yPoints(d.points).toFixed(1)}`
        )
        .join(" ");
      const rankLine = player.data
        .map(
          (d, i) =>
            `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yRank(d.rank).toFixed(1)}`
        )
        .join(" ");
      const pointsArea = `${pointsLine} L${xAt(player.data.length - 1).toFixed(1)},${baselineY} L${xAt(0).toFixed(1)},${baselineY} Z`;
      return { ...player, pointsLine, rankLine, pointsArea };
    });

    const rankTicks =
      maxRank <= 6
        ? Array.from({ length: maxRank }, (_, i) => i + 1)
        : [1, Math.ceil(maxRank / 2), maxRank];

    const labelIndexes = visibleSnapshots.map((_, i) => i).filter((i) => {
      if (visibleSnapshots.length <= 5) return true;
      if (i === 0 || i === visibleSnapshots.length - 1) return true;
      return i % Math.ceil(visibleSnapshots.length / 4) === 0;
    });

    const lastSnapshotIndex = visibleSnapshots.length - 1;
    const endLabels = isPool
      ? (() => {
          const raw = playerSeries.map((player) => {
            const lastPoints = player.data[lastSnapshotIndex]?.points ?? 0;
            return {
              player,
              lineY: yPoints(lastPoints),
              lastPoints,
            };
          });

          const labelPositions = layoutEndLabels(
            raw.map((item) => ({
              id: item.player.playerId,
              y: item.lineY,
            })),
            pad.top + 8,
            pad.top + plotH - 8,
            LABEL_MIN_GAP
          );

          return raw.map((item) => ({
            ...item,
            labelY: labelPositions.get(item.player.playerId) ?? item.lineY,
          }));
        })()
      : [];

    const drawOrder = isPool && highlightPlayerId
      ? [
          ...series.filter((s) => s.playerId !== highlightPlayerId),
          ...series.filter((s) => s.playerId === highlightPlayerId),
        ]
      : series;

    return {
      series: drawOrder,
      endLabels,
      rankTicks,
      labelIndexes,
      visibleSnapshots,
      xAt,
      yPoints,
      yRank,
      plotH,
      baselineY,
      pointsCeil,
      maxRank,
      pointTicks: (() => {
        const ticks: number[] = [];
        const tickStep = niceStep(pointsSpan);
        const start =
          pointsFloor > 0
            ? Math.floor(pointsFloor / tickStep) * tickStep
            : 0;
        for (let v = start; v < pointsCeil; v += tickStep) {
          if (v >= pointsFloor - 0.001) ticks.push(v);
        }
        if (!ticks.length || ticks[ticks.length - 1] !== pointsCeil) {
          ticks.push(pointsCeil);
        }
        if (!ticks.length || ticks[0] !== pointsFloor) {
          ticks.unshift(pointsFloor);
        }
        return [...new Set(ticks)].sort((a, b) => a - b);
      })(),
      pointsFloor,
    };
  }, [
    snapshots,
    highlightPlayerId,
    isPool,
    playerList,
    CHART_W,
    CHART_H,
    pad,
    snapshotStart,
    maxSnapshotStart,
  ]);

  const heading =
    title ??
    (isPool ? "Standings over time" : "Your standings");

  if (snapshots.length < 2 || !chart) {
    return (
      <section className="progress-chart-card card p-5 text-center">
        <h2 className="text-sm font-bold text-usa uppercase tracking-wide">
          {heading}
        </h2>
        <p className="text-sm text-ink-muted mt-3">
          This chart fills in as games finish and points add up.
        </p>
      </section>
    );
  }

  return (
    <section
      className={`progress-chart-card card space-y-4 relative ${
        isPool ? "p-4 sm:p-6" : "p-4 sm:p-5"
      }`}
    >
      {isPool && snapshots.length >= MIN_VISIBLE_SNAPSHOTS && (
        <div className="progress-chart-zoom-controls">
          <button
            type="button"
            onClick={() =>
              setSnapshotStart((start) => Math.max(0, start - 1))
            }
            disabled={snapshotStart <= 0}
            className="progress-chart-zoom-btn"
            aria-label="Zoom out on timeline"
          >
            −
          </button>
          <button
            type="button"
            onClick={() =>
              setSnapshotStart((start) =>
                Math.min(start + 1, maxSnapshotStart)
              )
            }
            disabled={snapshotStart >= maxSnapshotStart}
            className="progress-chart-zoom-btn"
            aria-label="Zoom in on timeline"
          >
            +
          </button>
        </div>
      )}

      <div className="space-y-1 min-w-0 pr-[8.5rem] sm:pr-36">
        <h2
          className={`font-bold text-usa uppercase tracking-wide ${
            isPool ? "text-base" : "text-sm"
          }`}
        >
          {heading}
        </h2>
        {isPool && highlightPlayerId && (
          <p className="text-xs text-ink-muted">
            Your line is bold with your name on the right.
          </p>
        )}
      </div>

      <div className="w-full overflow-x-auto -mx-1 px-1">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className={`w-full max-w-full ${
            isPool && size === "large"
              ? "aspect-[29/39] min-h-[28rem] sm:min-h-[34rem] lg:min-h-[42rem]"
              : "h-auto"
          } ${isPool ? "min-w-[320px]" : "min-w-[300px]"}`}
          role="img"
          aria-label={heading}
        >
          <defs>
            {!isPool && (
              <>
                <linearGradient
                  id={`${uid}-pointsFill`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#002868" stopOpacity="0.28" />
                  <stop offset="55%" stopColor="#1a4494" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#002868" stopOpacity="0" />
                </linearGradient>
                <filter
                  id={`${uid}-glow`}
                  x="-20%"
                  y="-20%"
                  width="140%"
                  height="140%"
                >
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </>
            )}
          </defs>

          {chart.pointTicks.map((tick) => {
            const y = chart.yPoints(tick);
            return (
              <g key={`grid-${tick}`}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={CHART_W - pad.right}
                  y2={y}
                  stroke="rgb(0 40 104 / 0.07)"
                  strokeWidth="1"
                  strokeDasharray={tick === chart.pointsFloor ? undefined : "3 4"}
                />
                <text
                  x={pad.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-ink-faint text-[9px] font-semibold tabular-nums"
                >
                  {formatPointsTick(tick)}
                </text>
              </g>
            );
          })}

          {!isPool &&
            chart.rankTicks.map((rank) => {
              const y = chart.yRank(rank);
              return (
                <text
                  key={`rank-tick-${rank}`}
                  x={CHART_W - pad.right + 8}
                  y={y + 3}
                  textAnchor="start"
                  className="fill-ink-faint text-[9px] font-bold tabular-nums"
                >
                  {formatRankLabel(rank)}
                </text>
              );
            })}

          <text
            x={pad.left - 8}
            y={pad.top - 6}
            textAnchor="end"
            className="text-[8px] font-extrabold uppercase tracking-wide fill-usa"
          >
            Pts
          </text>
          {!isPool && (
            <text
              x={CHART_W - pad.right + 8}
              y={pad.top - 6}
              textAnchor="start"
              className="fill-mexico text-[8px] font-extrabold uppercase tracking-wide"
            >
              Place
            </text>
          )}

          {chart.series.map((player) => {
            const isYou = highlightPlayerId === player.playerId;
            const lineColor = isPool && isYou ? YOU_COLOR : player.color;
            const lineOpacity =
              isPool && highlightPlayerId && !isYou ? 0.72 : 1;
            const lineWidth = isPool ? (isYou ? 4 : 2.75) : 2.75;

            return (
              <g key={player.playerId}>
                {!isPool && (
                  <>
                    <path
                      d={player.pointsArea}
                      fill={`url(#${uid}-pointsFill)`}
                    />
                    <path
                      d={player.pointsLine}
                      fill="none"
                      stroke={player.color}
                      strokeWidth={2.75}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter={`url(#${uid}-glow)`}
                    >
                      <title>
                        {`${player.displayName || "Player"} points over time`}
                      </title>
                    </path>
                    <path
                      d={player.rankLine}
                      fill="none"
                      stroke={player.color}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="6 4"
                      opacity={0.9}
                    >
                      <title>
                        {`${player.displayName || "Player"} place over time`}
                      </title>
                    </path>
                  </>
                )}
                {isPool && (
                  <path
                    d={player.pointsLine}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={lineWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={lineOpacity}
                  >
                    <title>
                      {`${player.displayName || "Player"}: ${player.data[player.data.length - 1]?.points ?? 0} pts now`}
                    </title>
                  </path>
                )}
              </g>
            );
          })}

          {isPool &&
            chart.endLabels.map(({ player, labelY, lastPoints }) => {
              const isYou = highlightPlayerId === player.playerId;
              const lineColor = isYou ? YOU_COLOR : player.color;
              const labelX = CHART_W - 6;

              return (
                <g key={`label-${player.playerId}`}>
                  <text
                    x={labelX}
                    y={labelY + 4}
                    textAnchor="end"
                    className={`tabular-nums ${
                      isYou
                        ? "text-[11px] font-extrabold"
                        : "text-[10px] font-bold"
                    }`}
                    fill={lineColor}
                    opacity={isYou ? 1 : highlightPlayerId ? 0.9 : 1}
                  >
                    {firstName(player.displayName)}
                    <title>
                      {`${player.displayName}: ${lastPoints} pts`}
                    </title>
                  </text>
                </g>
              );
            })}

          {chart.labelIndexes.map((i) => (
            <text
              key={`label-${chart.visibleSnapshots[i].id}`}
              x={chart.xAt(i)}
              y={CHART_H - 10}
              textAnchor="middle"
              className="fill-ink-muted text-[9px] font-semibold"
            >
              {chart.visibleSnapshots[i].label}
            </text>
          ))}
        </svg>
      </div>

      {!isPool && (
        <div className="flex flex-wrap items-center justify-center gap-5 pt-2 border-t border-ink/5">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-ink-muted">
            <span className="relative h-1 w-7 rounded-full overflow-hidden bg-usa/20">
              <span className="absolute inset-0 bg-gradient-to-r from-usa-light to-usa rounded-full" />
            </span>
            Points
          </span>
          <span className="inline-flex items-center gap-2 text-xs font-medium text-ink-muted">
            <svg width="28" height="4" viewBox="0 0 28 4" aria-hidden>
              <line
                x1="0"
                y1="2"
                x2="28"
                y2="2"
                stroke="#006847"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="5 4"
              />
            </svg>
            Place on board
          </span>
        </div>
      )}
    </section>
  );
}
