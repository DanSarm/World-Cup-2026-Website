"use client";



import { useState, useTransition } from "react";

import {

  adminSaveMatchResultAction,

  adminUpdateMatchAction,

  adminImportCsvAction,

} from "@/lib/actions";

import { formatKickoff } from "@/lib/utils";

import { TeamFlag } from "@/components/Flag";
import { AdminMatchBonusesModal } from "@/components/AdminMatchBonusesModal";
import { MatchBonusPills } from "@/components/MatchBonusPills";
import { MatchOddsBar } from "@/components/MatchOddsBar";

import type { Match, Team } from "@/lib/types";



export function AdminMatches({

  matches,

  teams,
  oddsApiConfigured = true,
  oddsSchemaOk = true,
  oddsSchemaError,
}: {

  matches: Match[];

  teams: Team[];
  oddsApiConfigured?: boolean;
  oddsSchemaOk?: boolean;
  oddsSchemaError?: string;

}) {

  const [pending, startTransition] = useTransition();

  const [editMatch, setEditMatch] = useState<Match | null>(null);

  const [scoreMatch, setScoreMatch] = useState<Match | null>(null);
  const [bonusMatch, setBonusMatch] = useState<Match | null>(null);

  const [csvText, setCsvText] = useState("");

  const [message, setMessage] = useState<string | null>(null);
  const [oddsSyncPending, setOddsSyncPending] = useState(false);

  async function syncAllOdds() {
    setOddsSyncPending(true);
    try {
      const res = await fetch("/api/admin/odds/sync-upcoming", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? data.schemaError ?? `Odds sync failed (${res.status})`);
      } else if (data.schemaError) {
        setMessage(data.schemaError);
      } else {
        setMessage(
          `Odds sync: ${data.synced} synced, ${data.skipped} skipped, ${data.failed} failed, ${data.needsManual} need manual match`
        );
      }
    } catch {
      setMessage("Network error during odds sync");
    } finally {
      setOddsSyncPending(false);
    }
  }



  function handleImport() {

    startTransition(async () => {

      const result = await adminImportCsvAction(csvText);

      setMessage(result.error ?? `Imported ${"imported" in result ? result.imported : 0} matches`);

    });

  }



  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {

    e.preventDefault();

    const fd = new FormData(e.currentTarget);

    startTransition(async () => {

      await adminUpdateMatchAction(fd);

      setEditMatch(null);

      setMessage("Match updated");

    });

  }



  function handleScore(e: React.FormEvent<HTMLFormElement>) {

    e.preventDefault();

    const fd = new FormData(e.currentTarget);

    startTransition(async () => {

      const result = await adminSaveMatchResultAction(fd);

      setMessage(result.error ?? "Score saved");

      setScoreMatch(null);

    });

  }



  return (

    <div className="space-y-4">

      {!oddsSchemaOk && (
        <div className="alert-error text-sm space-y-1">
          <p className="font-bold">Database needs odds columns</p>
          <p>{oddsSchemaError}</p>
          <p className="text-xs opacity-90">
            Copy all of <code>supabase/migrations/upgrade_odds_and_bonuses.sql</code> into Supabase SQL Editor and run it.
          </p>
        </div>
      )}

      {!oddsApiConfigured && (
        <div className="alert-pending text-sm">
          <strong>ODDS_API_KEY</strong> is not set. The app works without it — use manual bonus entry or add your key from{" "}
          <a href="https://the-odds-api.com/" className="underline" target="_blank" rel="noreferrer">
            The Odds API
          </a>
          .
        </div>
      )}

      <div className="card space-y-3">
        <h3 className="card-title">Sync odds (admin)</h3>
        <p className="text-help">
          Pull match odds from The Odds API to calculate bonus points. Users only see bonus pills — never raw odds.
          Requires <code className="text-xs">ODDS_API_KEY</code> in env.
        </p>
        <button
          type="button"
          disabled={oddsSyncPending}
          onClick={syncAllOdds}
          className="btn-primary w-full sm:w-auto"
        >
          {oddsSyncPending ? "Syncing…" : "Sync odds for all upcoming matches"}
        </button>
      </div>

      <div className="card space-y-3">

        <h3 className="card-title">Import CSV</h3>

        <p className="text-help">

          Columns: match_number, stage, group_letter, kickoff_at, venue, city, home_team_code, away_team_code, home_label, away_label

        </p>

        <textarea

          value={csvText}

          onChange={(e) => setCsvText(e.target.value)}

          className="input-field text-xs font-mono h-24"

          placeholder="Paste CSV here..."

        />

        <button type="button" onClick={handleImport} disabled={pending} className="btn-primary w-full text-sm">

          Import Fixtures

        </button>

      </div>



      {message && <p className="text-success">{message}</p>}



      <div className="space-y-2 max-h-96 overflow-y-auto">

        {matches.map((m) => {

          const homeTeam = teams.find((t) => t.id === m.home_team_id);

          const awayTeam = teams.find((t) => t.id === m.away_team_id);

          return (

          <div key={m.id} className="card p-4 space-y-1">

            <div className="flex justify-between items-start gap-2">

              <div className="text-sm min-w-0">

                <div className="flex items-center gap-2 mb-1">

                  <TeamFlag team={homeTeam} size="xs" />

                  <span className="text-ink-faint text-xs">vs</span>

                  <TeamFlag team={awayTeam} size="xs" />

                </div>

                <span className="font-bold text-pitch-900">#{m.match_number}</span>{" "}

                <span className="text-ink">{m.home_label} vs {m.away_label}</span>

                <div className="text-help mt-0.5">{formatKickoff(m.kickoff_at)} · {m.status}</div>

                {m.status === "final" && m.home_score !== null && (

                  <div className="text-xs font-bold text-pitch-700 mt-1">

                    {m.home_score}–{m.away_score}

                  </div>

                )}

                <MatchOddsBar match={m} />
                <MatchBonusPills match={m} />

              </div>

              <div className="flex gap-1 shrink-0 flex-wrap justify-end">

                <button

                  type="button"

                  onClick={() => setBonusMatch(m)}

                  className="btn-chip btn-chip-warning"

                >

                  Bonuses

                </button>

                <button

                  type="button"

                  onClick={() => setEditMatch(m)}

                  className="btn-chip btn-chip-neutral"

                >

                  Edit

                </button>

                <button

                  type="button"

                  onClick={() => setScoreMatch(m)}

                  className="btn-chip btn-chip-info"

                >

                  Score

                </button>

              </div>

            </div>

          </div>

          );

        })}

      </div>



      {editMatch && (

        <Modal onClose={() => setEditMatch(null)}>

          <form onSubmit={handleUpdate} className="space-y-3">

            <h3 className="card-title text-base">Edit Match #{editMatch.match_number}</h3>

            <input type="hidden" name="matchId" value={editMatch.id} />

            <input name="home_label" defaultValue={editMatch.home_label} className="input-field text-sm" placeholder="Home label" />

            <input name="away_label" defaultValue={editMatch.away_label} className="input-field text-sm" placeholder="Away label" />

            <input name="venue" defaultValue={editMatch.venue ?? ""} className="input-field text-sm" placeholder="Venue" />

            <input

              name="kickoff_at"

              type="datetime-local"

              defaultValue={editMatch.kickoff_at ? editMatch.kickoff_at.slice(0, 16) : ""}

              className="input-field text-sm"

            />

            <select name="home_team_id" defaultValue={editMatch.home_team_id ?? ""} className="input-field text-sm">

              <option value="">No home team</option>

              {teams.map((t) => (

                <option key={t.id} value={t.id}>{t.fifa_code} — {t.name}</option>

              ))}

            </select>

            <select name="away_team_id" defaultValue={editMatch.away_team_id ?? ""} className="input-field text-sm">

              <option value="">No away team</option>

              {teams.map((t) => (

                <option key={t.id} value={t.id}>{t.fifa_code} — {t.name}</option>

              ))}

            </select>

            <button type="submit" disabled={pending} className="btn-primary w-full">Save</button>

          </form>

        </Modal>

      )}



      {scoreMatch && (

        <Modal onClose={() => setScoreMatch(null)}>

          <form onSubmit={handleScore} className="space-y-3">

            <h3 className="card-title text-base">Enter Score #{scoreMatch.match_number}</h3>

            <input type="hidden" name="matchId" value={scoreMatch.id} />

            <div className="flex gap-2">

              <input name="homeScore" type="number" min={0} required className="input-field" placeholder="Home" />

              <input name="awayScore" type="number" min={0} required className="input-field" placeholder="Away" />

            </div>

            {scoreMatch.stage !== "group" && (

              <>

                <select name="winnerTeamId" className="input-field text-sm">

                  <option value="">Winner (if tied)</option>

                  {scoreMatch.home_team_id && (

                    <option value={scoreMatch.home_team_id}>{scoreMatch.home_label}</option>

                  )}

                  {scoreMatch.away_team_id && (

                    <option value={scoreMatch.away_team_id}>{scoreMatch.away_label}</option>

                  )}

                </select>

                <label className="flex items-center gap-2 text-sm text-ink-muted">

                  <input name="decidedByPenalties" type="checkbox" />

                  Decided by penalties

                </label>

              </>

            )}

            <button type="submit" disabled={pending} className="btn-primary w-full">Save Final Score</button>

          </form>

        </Modal>

      )}

      {bonusMatch && (
        <AdminMatchBonusesModal
          match={bonusMatch}
          onClose={() => setBonusMatch(null)}
          onSaved={setMessage}
        />
      )}

    </div>

  );

}



function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {

  return (

    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>

      <div className="card max-w-sm w-full" onClick={(e) => e.stopPropagation()}>

        {children}

      </div>

    </div>

  );

}

