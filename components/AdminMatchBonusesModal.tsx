"use client";

import { useState, useTransition } from "react";
import {
  adminLockOddsAction,
  adminMarkManualOddsAction,
  adminUnlockOddsAction,
  adminUpdateMatchBonusesAction,
} from "@/lib/actions";
import { BONUS_ADMIN_GUIDE } from "@/lib/matchBonuses";
import { isKnockoutStage, type Match } from "@/lib/types";

interface SyncResponse {
  status: string;
  message?: string;
  bookmakerCount?: number;
  suggestions?: Array<{
    id: string;
    home_team: string;
    away_team: string;
    commence_time: string;
  }>;
}

export function AdminMatchBonusesModal({
  match,
  onClose,
  onSaved,
}: {
  match: Match;
  onClose: () => void;
  onSaved?: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [syncPending, setSyncPending] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SyncResponse["suggestions"]>([]);
  const [forceLocked, setForceLocked] = useState(false);
  const isKO = isKnockoutStage(match.stage);
  const isLocked =
    match.odds_status === "locked" || Boolean(match.odds_locked_at);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (isLocked && !forceLocked) {
      setSyncMsg("Confirm override to save while odds are locked.");
      return;
    }
    if (forceLocked) fd.set("forceLocked", "1");

    startTransition(async () => {
      await adminUpdateMatchBonusesAction(fd);
      onSaved?.("Bonuses saved");
      onClose();
    });
  }

  async function syncMatch(force = false, eventId?: string) {
    setSyncPending(true);
    setSyncMsg(null);
    try {
      const res = await fetch(`/api/admin/odds/sync-match/${match.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force, eventId }),
      });
      const data = (await res.json()) as SyncResponse & { error?: string };
      if (!res.ok) {
        setSyncMsg(data.error ?? "Sync failed");
      } else {
        setSyncMsg(data.message ?? `Status: ${data.status}`);
        if (data.suggestions?.length) setSuggestions(data.suggestions);
        if (data.status === "synced") onSaved?.("Odds synced");
      }
    } catch {
      setSyncMsg("Network error during sync");
    } finally {
      setSyncPending(false);
    }
  }

  function handleOddsAction(action: "lock" | "unlock" | "manual") {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("matchId", match.id);
      if (action === "lock") await adminLockOddsAction(fd);
      else if (action === "unlock") {
        const r = await adminUnlockOddsAction(fd);
        if (r.error) setSyncMsg(r.error);
        else onSaved?.("Odds unlocked");
      } else {
        await adminMarkManualOddsAction(fd);
        onSaved?.("Marked as manual odds");
      }
    });
  }

  const prob = (v: number | null | undefined) =>
    v != null ? `${(v * 100).toFixed(1)}%` : "—";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="card max-w-lg w-full space-y-4 my-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="card-title text-base">
            Odds & Bonuses · #{match.match_number}
          </h3>
          <p className="text-help mt-1">
            {match.home_label} vs {match.away_label}
          </p>
          <p className="text-[11px] text-ink-faint mt-2">
            Odds create bonus points for harder picks. Users only see bonus points, not betting odds.
          </p>
        </div>

        <input type="hidden" name="matchId" value={match.id} />

        {/* Odds sync (admin only) */}
        <section className="rounded-xl bg-cream p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              Odds sync
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">
              {match.odds_status ?? "not_synced"}
              {isLocked ? " · locked" : ""}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink-muted">
            <span>Last synced</span>
            <span className="text-ink font-medium text-right">
              {match.odds_last_synced_at
                ? new Date(match.odds_last_synced_at).toLocaleString()
                : "Never"}
            </span>
            <span>Provider</span>
            <span className="text-ink font-medium text-right">
              {match.odds_source_note ?? "—"}
            </span>
            <span>Event ID</span>
            <span className="text-ink font-mono text-[10px] text-right truncate">
              {match.odds_event_id ?? "—"}
            </span>
          </div>

          {!isKO && (
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <div className="rounded-lg bg-white/80 p-2">
                <div className="text-ink-faint">Home prob</div>
                <div className="font-bold">{prob(match.home_implied_probability)}</div>
                <div className="text-usa">+{match.home_win_bonus ?? 0} bonus</div>
              </div>
              <div className="rounded-lg bg-white/80 p-2">
                <div className="text-ink-faint">Draw prob</div>
                <div className="font-bold">{prob(match.draw_implied_probability)}</div>
                <div className="text-usa">+{match.draw_bonus ?? 0} bonus</div>
              </div>
              <div className="rounded-lg bg-white/80 p-2">
                <div className="text-ink-faint">Away prob</div>
                <div className="font-bold">{prob(match.away_implied_probability)}</div>
                <div className="text-usa">+{match.away_win_bonus ?? 0} bonus</div>
              </div>
            </div>
          )}

          {isKO && (
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="rounded-lg bg-white/80 p-2">
                <div className="text-ink-faint">Home advance prob</div>
                <div className="font-bold">{prob(match.home_advance_probability)}</div>
                <div className="text-usa">+{match.home_advance_bonus ?? 0} bonus</div>
              </div>
              <div className="rounded-lg bg-white/80 p-2">
                <div className="text-ink-faint">Away advance prob</div>
                <div className="font-bold">{prob(match.away_advance_probability)}</div>
                <div className="text-usa">+{match.away_advance_bonus ?? 0} bonus</div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={syncPending || pending}
              onClick={() => syncMatch(false)}
              className="btn-secondary text-xs py-2 px-3"
            >
              {syncPending ? "Syncing…" : "Sync odds"}
            </button>
            {isLocked ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => handleOddsAction("unlock")}
                className="btn-secondary text-xs py-2 px-3"
              >
                Unlock
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => handleOddsAction("lock")}
                className="btn-secondary text-xs py-2 px-3"
              >
                Lock odds
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => handleOddsAction("manual")}
              className="btn-secondary text-xs py-2 px-3"
            >
              Mark manual
            </button>
          </div>

          {syncMsg && (
            <p className="text-xs text-canada font-medium">{syncMsg}</p>
          )}

          {suggestions && suggestions.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase text-ink-muted">
                Link odds event manually
              </p>
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={syncPending}
                  onClick={() => syncMatch(false, s.id)}
                  className="w-full text-left text-xs rounded-lg border border-ink/10 px-2 py-1.5 hover:border-usa/40"
                >
                  {s.home_team} vs {s.away_team}
                  <span className="text-ink-faint ml-1">
                    · {new Date(s.commence_time).toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Manual bonus override */}
        {!isKO ? (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label text-[10px]">Home win bonus</label>
              <input
                name="home_win_bonus"
                type="number"
                min={0}
                defaultValue={match.home_win_bonus ?? 0}
                className="input-field text-sm py-2"
              />
            </div>
            <div>
              <label className="label text-[10px]">Draw bonus</label>
              <input
                name="draw_bonus"
                type="number"
                min={0}
                defaultValue={match.draw_bonus ?? 0}
                className="input-field text-sm py-2"
              />
            </div>
            <div>
              <label className="label text-[10px]">Away win bonus</label>
              <input
                name="away_win_bonus"
                type="number"
                min={0}
                defaultValue={match.away_win_bonus ?? 0}
                className="input-field text-sm py-2"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-[10px]">Home advances bonus</label>
              <input
                name="home_advance_bonus"
                type="number"
                min={0}
                defaultValue={match.home_advance_bonus ?? 0}
                className="input-field text-sm py-2"
              />
            </div>
            <div>
              <label className="label text-[10px]">Away advances bonus</label>
              <input
                name="away_advance_bonus"
                type="number"
                min={0}
                defaultValue={match.away_advance_bonus ?? 0}
                className="input-field text-sm py-2"
              />
            </div>
          </div>
        )}

        {isKO ? (
          <>
            <input type="hidden" name="home_win_bonus" value={0} />
            <input type="hidden" name="draw_bonus" value={0} />
            <input type="hidden" name="away_win_bonus" value={0} />
          </>
        ) : (
          <>
            <input type="hidden" name="home_advance_bonus" value={0} />
            <input type="hidden" name="away_advance_bonus" value={0} />
          </>
        )}

        <div>
          <label className="label">Source note (admin only)</label>
          <input
            name="odds_source_note"
            type="text"
            defaultValue={match.odds_source_note ?? ""}
            className="input-field text-sm py-2"
            placeholder="e.g. The Odds API, manual estimate"
          />
        </div>

        {isLocked && (
          <label className="flex items-start gap-2 text-xs text-canada">
            <input
              type="checkbox"
              checked={forceLocked}
              onChange={(e) => setForceLocked(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Odds are locked. Confirm to override bonus points manually (this will not unblock automatic sync).
            </span>
          </label>
        )}

        <div className="rounded-xl bg-cream p-3 space-y-2">
          <p className="text-xs font-bold text-ink-muted uppercase tracking-wide">
            Bonus tiers (from implied probability)
          </p>
          <ul className="text-xs text-ink-muted space-y-1">
            <li>≥50% → 0 · ≥35% → +1 · ≥20% → +2 · ≥10% → +3 · &lt;10% → +5</li>
            {BONUS_ADMIN_GUIDE.map((row) => (
              <li key={row.label}>
                <span className="font-semibold text-ink">{row.label}:</span>{" "}
                {isKO
                  ? `underdog advance +${row.awayAdv}`
                  : `draw +${row.draw}, away +${row.away}`}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" disabled={pending} className="btn-primary flex-1">
            Save Bonuses
          </button>
        </div>
      </form>
    </div>
  );
}
