import { getMatchOddsSegments, hasMatchOdds } from "@/lib/matchOdds";
import { isKnockoutStage, type Match } from "@/lib/types";

export function MatchOddsBar({ match }: { match: Match }) {
  if (!hasMatchOdds(match)) return null;

  const segments = getMatchOddsSegments(match);
  if (!segments?.length) return null;

  const isKO = isKnockoutStage(match.stage);

  return (
    <div className="rounded-xl bg-cream/80 border border-ink/5 px-3 py-2.5 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-ink-faint text-center">
        {isKO ? "Advance chance" : "Win chance"}
      </p>

      {/* Stacked bar */}
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-ink/10"
        role="img"
        aria-label={segments.map((s) => `${s.label} ${s.pct}%`).join(", ")}
      >
        {segments.map((seg) => (
          <div
            key={seg.key}
            className={`${seg.barClass} min-w-[2px] transition-all`}
            style={{ width: `${seg.pct}%` }}
            title={`${seg.label} ${seg.pct}%`}
          />
        ))}
      </div>

      {/* Labels */}
      <div
        className={`grid gap-1 ${segments.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}
      >
        {segments.map((seg) => (
          <div
            key={seg.key}
            className={`flex items-center gap-1 min-w-0 ${
              seg.key === "away" ? "justify-end" : seg.key === "draw" ? "justify-center" : ""
            }`}
          >
            <span className={`shrink-0 w-2 h-2 rounded-full ${seg.dotClass}`} />
            <span className="text-[11px] text-ink-muted truncate">
              <span
                className={`font-semibold text-ink ${
                  seg.key !== "draw" ? "font-team-code" : ""
                }`}
              >
                {seg.label}
              </span>{" "}
              <span className={`tabular-nums font-semibold ${seg.textClass}`}>
                {seg.pct}%
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
