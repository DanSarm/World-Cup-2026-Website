"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminImportMarketCsvAction,
  adminUpdateTeamMarketAction,
} from "@/lib/actions";
import {
  calculateTeamTournamentValue,
  formatMarketWinPercent,
  tournamentPlacePoints,
} from "@/lib/tournamentValue";
import type { Team } from "@/lib/types";

interface AdminMarketOddsProps {
  teams: Team[];
}

interface RowDraft {
  marketRank: string;
  marketWinPercentage: string;
  marketLabel: string;
  tournamentValueOverride: string;
}

function draftFromTeam(team: Team): RowDraft {
  return {
    marketRank: team.market_rank != null ? String(team.market_rank) : "",
    marketWinPercentage:
      team.market_win_percentage != null
        ? String(team.market_win_percentage)
        : "",
    marketLabel: team.market_label ?? "",
    tournamentValueOverride:
      team.tournament_value_override != null
        ? String(team.tournament_value_override)
        : "",
  };
}

function draftValue(draft: RowDraft): number {
  const override = Number(draft.tournamentValueOverride);
  const pct = Number(draft.marketWinPercentage);
  return calculateTeamTournamentValue({
    market_win_percentage:
      draft.marketWinPercentage && Number.isFinite(pct) ? pct : null,
    tournament_value_override:
      draft.tournamentValueOverride && Number.isFinite(override)
        ? override
        : null,
  });
}

export function AdminMarketOdds({ teams }: AdminMarketOddsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [csv, setCsv] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const sorted = [...teams].sort((a, b) => {
    const aRank = a.market_rank ?? Infinity;
    const bRank = b.market_rank ?? Infinity;
    if (aRank !== bRank) return aRank - bRank;
    return a.fifa_code.localeCompare(b.fifa_code);
  });

  function updateDraft(teamId: string, patch: Partial<RowDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [teamId]: { ...prev[teamId], ...patch },
    }));
  }

  function startEditing(team: Team) {
    setEditingId(team.id);
    setDrafts((prev) => ({
      ...prev,
      [team.id]: prev[team.id] ?? draftFromTeam(team),
    }));
  }

  function saveRow(teamId: string) {
    const draft = drafts[teamId];
    if (!draft) return;
    const fd = new FormData();
    fd.set("teamId", teamId);
    fd.set("marketRank", draft.marketRank);
    fd.set("marketWinPercentage", draft.marketWinPercentage);
    fd.set("marketLabel", draft.marketLabel);
    fd.set("tournamentValueOverride", draft.tournamentValueOverride);

    startTransition(async () => {
      const result = await adminUpdateTeamMarketAction(fd);
      setMessage(result.error ?? "Saved");
      if (!result.error) setEditingId(null);
      router.refresh();
    });
  }

  function importCsv() {
    const fd = new FormData();
    fd.set("csv", csv);
    startTransition(async () => {
      const result = await adminImportMarketCsvAction(fd);
      setMessage(
        result.error ?? `Imported ${result.imported ?? 0} rows`
      );
      if (!result.error) setCsv("");
      router.refresh();
    });
  }

  return (
    <section className="space-y-3">
      <div className="px-0.5">
        <h2 className="section-title">Tournament Pick Market</h2>
        <p className="text-xs text-ink-muted mt-0.5">
          Market win % drives Tournament Pick points · champion value =
          round(100 / win %), clamped 5–250
        </p>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-ink/5 bg-cream/30 space-y-2">
          <p className="text-xs font-bold text-ink-muted uppercase tracking-wide">
            CSV import
          </p>
          <p className="text-[11px] text-ink-faint leading-snug">
            Format: team_code, market_rank, market_win_percentage, market_label
            — leave % empty on &ldquo;&lt;1%&rdquo; rows to auto-estimate from rank
            (18–24 → 0.8, 25–32 → 0.5, 33–48 → 0.4)
          </p>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={3}
            placeholder={"ESP,1,15,\nHAI,37,,<1%"}
            className="input-field text-xs font-mono w-full py-2"
            disabled={pending}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={importCsv}
              disabled={pending || !csv.trim()}
              className="btn-primary text-sm px-4 py-2"
            >
              {pending ? "Working..." : "Import CSV"}
            </button>
            {message && (
              <p className="text-xs font-medium text-ink-muted">{message}</p>
            )}
          </div>
        </div>

        <ul className="divide-y divide-ink/5 max-h-[28rem] overflow-y-auto">
          {sorted.map((team) => {
            const isEditing = editingId === team.id;
            const draft = drafts[team.id] ?? draftFromTeam(team);
            const value = isEditing
              ? draftValue(draft)
              : calculateTeamTournamentValue(team);

            return (
              <li key={team.id} className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 w-8 text-center text-[11px] font-bold text-ink-faint tabular-nums">
                    {team.market_rank ?? "—"}
                  </span>
                  <span aria-hidden className="shrink-0">
                    {team.flag_emoji}
                  </span>
                  <span className="font-bold text-ink text-sm w-12 shrink-0">
                    {team.fifa_code}
                  </span>
                  <span className="flex-1 min-w-0 text-xs text-ink-muted truncate">
                    {formatMarketWinPercent(team)}
                    {team.tournament_value_override != null && (
                      <span className="text-canada font-semibold"> · override</span>
                    )}
                  </span>
                  <span className="shrink-0 text-right text-xs tabular-nums text-ink-muted">
                    <span className="font-extrabold text-usa text-sm">
                      {value || "—"}
                    </span>
                    {value > 0 && (
                      <span className="block text-[10px] text-ink-faint">
                        {tournamentPlacePoints(
                          isEditing
                            ? {
                                market_win_percentage:
                                  Number(draft.marketWinPercentage) || null,
                                tournament_value_override:
                                  Number(draft.tournamentValueOverride) || null,
                              }
                            : team,
                          "runnerUp"
                        )}
                        {" / "}
                        {tournamentPlacePoints(
                          isEditing
                            ? {
                                market_win_percentage:
                                  Number(draft.marketWinPercentage) || null,
                                tournament_value_override:
                                  Number(draft.tournamentValueOverride) || null,
                              }
                            : team,
                          "thirdPlace"
                        )}
                        {" 2nd/3rd"}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      isEditing ? setEditingId(null) : startEditing(team)
                    }
                    disabled={pending}
                    className="shrink-0 text-xs font-semibold text-usa hover:underline"
                  >
                    {isEditing ? "Close" : "Edit"}
                  </button>
                </div>

                {isEditing && (
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                        Rank
                      </span>
                      <input
                        type="number"
                        value={draft.marketRank}
                        onChange={(e) =>
                          updateDraft(team.id, { marketRank: e.target.value })
                        }
                        className="input-field text-sm py-1.5 w-full"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                        Win %
                      </span>
                      <input
                        type="number"
                        step="0.1"
                        value={draft.marketWinPercentage}
                        onChange={(e) =>
                          updateDraft(team.id, {
                            marketWinPercentage: e.target.value,
                          })
                        }
                        className="input-field text-sm py-1.5 w-full"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                        Label
                      </span>
                      <input
                        type="text"
                        value={draft.marketLabel}
                        onChange={(e) =>
                          updateDraft(team.id, { marketLabel: e.target.value })
                        }
                        placeholder="<1%"
                        className="input-field text-sm py-1.5 w-full"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                        Value override
                      </span>
                      <input
                        type="number"
                        value={draft.tournamentValueOverride}
                        onChange={(e) =>
                          updateDraft(team.id, {
                            tournamentValueOverride: e.target.value,
                          })
                        }
                        placeholder="auto"
                        className="input-field text-sm py-1.5 w-full"
                      />
                    </label>
                    <div className="col-span-2 sm:col-span-4">
                      <button
                        type="button"
                        onClick={() => saveRow(team.id)}
                        disabled={pending}
                        className="btn-primary text-sm px-4 py-2"
                      >
                        {pending ? "Saving..." : "Save team"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
