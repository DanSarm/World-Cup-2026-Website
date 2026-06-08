"use client";



import { useState, useTransition } from "react";

import {

  adminUpdateSettingsAction,

  adminRecalculateAction,

  adminExportCsvAction,

  adminAddTeamAction,

} from "@/lib/actions";

import type { Settings, Player } from "@/lib/types";



export function AdminSettings({

  settings,

  players,

}: {

  settings: Settings;

  players: Player[];

}) {

  const [pending, startTransition] = useTransition();

  const [message, setMessage] = useState<string | null>(null);



  function handleSettings(e: React.FormEvent<HTMLFormElement>) {

    e.preventDefault();

    const fd = new FormData(e.currentTarget);

    startTransition(async () => {

      const result = await adminUpdateSettingsAction(fd);

      setMessage(result.error ?? "Settings saved");

    });

  }



  function recalculate() {

    startTransition(async () => {

      await adminRecalculateAction();

      setMessage("Scores recalculated");

    });

  }



  function exportCsv(type: string) {

    startTransition(async () => {

      const csv = await adminExportCsvAction(type);

      const blob = new Blob([csv], { type: "text/csv" });

      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");

      a.href = url;

      a.download = `${type}.csv`;

      a.click();

    });

  }



  function handleAddTeam(e: React.FormEvent<HTMLFormElement>) {

    e.preventDefault();

    const fd = new FormData(e.currentTarget);

    startTransition(async () => {

      await adminAddTeamAction(fd);

      setMessage("Team added");

      (e.target as HTMLFormElement).reset();

    });

  }



  const pct = settings.payout_percentages;



  return (

    <div className="space-y-4">

      <form onSubmit={handleSettings} className="card space-y-3">

        <h3 className="card-title">Pool Settings</h3>



        <div>

          <label className="label">Buy-in ($)</label>

          <input name="buy_in" type="number" defaultValue={settings.buy_in} className="input-field" />

        </div>



        <div className="grid grid-cols-2 gap-2">

          {(

            [

              ["overall_first", "1st Overall %"],

              ["overall_second", "2nd Overall %"],

              ["overall_third", "3rd Overall %"],

              ["exact_score", "Exact Score %"],

              ["finals_challenge", "Finals Challenge %"],

              ["fun_prize", "Fun Prize %"],

            ] as const

          ).map(([key, label]) => (

            <div key={key}>

              <label className="label">{label}</label>

              <input

                name={key}

                type="number"

                defaultValue={pct[key]}

                className="input-field text-sm py-2"

              />

            </div>

          ))}

        </div>



        <div className="rounded-xl bg-cream p-3 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-ink-muted">
            Scoring
          </h4>
          <p className="text-xs text-ink-muted leading-snug">
            Odds create bonus points for harder picks. Users only see simple bonus points.
            Big underdog wins and wild exact scores can earn huge points.
          </p>
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input
              name="exact_score_fire_bonus_enabled"
              type="checkbox"
              defaultChecked={settings.exact_score_fire_bonus_enabled}
            />
            Exact score fire bonus
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            <input
              name="perfect_day_bonus_enabled"
              type="checkbox"
              defaultChecked={settings.perfect_day_bonus_enabled}
            />
            Perfect Day bonus (+{settings.perfect_day_bonus_points})
          </label>
          <div>
            <label className="label">Max group-stage match points</label>
            <input
              name="group_stage_match_point_cap"
              type="number"
              min={6}
              max={30}
              defaultValue={settings.group_stage_match_point_cap}
              className="input-field text-sm py-2"
            />
          </div>
          <div>
            <label className="label">Perfect Day bonus points</label>
            <input
              name="perfect_day_bonus_points"
              type="number"
              min={0}
              max={20}
              defaultValue={settings.perfect_day_bonus_points}
              className="input-field text-sm py-2"
            />
          </div>
          <div>
            <label className="label">Odds lock (hours before kickoff)</label>
            <input
              name="odds_lock_hours_before_kickoff"
              type="number"
              min={0}
              max={24}
              defaultValue={settings.odds_lock_hours_before_kickoff}
              className="input-field text-sm py-2"
            />
          </div>
        </div>



        <div className="space-y-2">

          <label className="flex items-center gap-2 text-sm text-ink-muted">

            <input name="big_predictions_locked" type="checkbox" defaultChecked={settings.big_predictions_locked} />

            Lock Big Picks

          </label>

          <label className="flex items-center gap-2 text-sm text-ink-muted">

            <input name="finals_challenge_open" type="checkbox" defaultChecked={settings.finals_challenge_open} />

            Open Finals Challenge

          </label>

          <label className="flex items-center gap-2 text-sm text-ink-muted">

            <input name="tournament_complete" type="checkbox" defaultChecked={settings.tournament_complete} />

            Tournament Complete

          </label>

        </div>



        <div>

          <label className="label">Fun Prize Winner</label>

          <select name="fun_prize_winner_id" defaultValue={settings.fun_prize_winner_id ?? ""} className="input-field text-sm py-2">

            <option value="">— None —</option>

            {players.map((p) => (

              <option key={p.id} value={p.id}>{p.display_name}</option>

            ))}

          </select>

        </div>



        {message && <p className="text-success">{message}</p>}



        <button type="submit" disabled={pending} className="btn-primary w-full">Save Settings</button>

      </form>



      <div className="card space-y-2">

        <h3 className="card-title">Actions</h3>

        <button type="button" onClick={recalculate} disabled={pending} className="btn-secondary w-full text-sm">

          Recalculate Scores

        </button>

        <div className="flex gap-2">

          <button type="button" onClick={() => exportCsv("players")} className="btn-secondary flex-1 text-xs">Export Players</button>

          <button type="button" onClick={() => exportCsv("picks")} className="btn-secondary flex-1 text-xs">Export Picks</button>

          <button type="button" onClick={() => exportCsv("leaderboard")} className="btn-secondary flex-1 text-xs">Export Board</button>

        </div>

      </div>



      <form onSubmit={handleAddTeam} className="card space-y-3">

        <h3 className="card-title">Add Team</h3>

        <input name="name" required className="input-field text-sm" placeholder="Full name" />

        <input name="short_name" required className="input-field text-sm" placeholder="Short name" />

        <input name="fifa_code" required className="input-field text-sm" placeholder="FIFA code (3 letters)" />

        <input name="flag_emoji" required className="input-field text-sm" placeholder="Flag emoji" />

        <input name="group_letter" className="input-field text-sm" placeholder="Group letter (optional)" />

        <button type="submit" disabled={pending} className="btn-primary w-full text-sm">Add Team</button>

      </form>

    </div>

  );

}

