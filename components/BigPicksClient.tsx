"use client";

import { useState, useTransition } from "react";
import confetti from "canvas-confetti";
import { saveBigPicksAction, saveFinalsChallengeAction } from "@/lib/actions";
import { GROUP_LETTERS } from "@/lib/types";
import { PageHeader } from "./PageHeader";
import { TeamFlag } from "./Flag";
import type { Team, BigPrediction, FinalsChallengePrediction } from "@/lib/types";

interface BigPicksClientProps {
  teams: Team[];
  myBigPick?: BigPrediction | null;
  myFinalsPick?: FinalsChallengePrediction | null;
  bigLocked: boolean;
  finalsOpen: boolean;
  firstMatchStarted: boolean;
}

export function BigPicksClient({
  teams,
  myBigPick,
  myFinalsPick,
  bigLocked,
  finalsOpen,
  firstMatchStarted,
}: BigPicksClientProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const favorites = ["BRA", "ARG", "FRA", "ENG", "GER", "ESP", "POR", "NED"];
  const favTeams = teams.filter((t) => favorites.includes(t.fifa_code));

  function autoFavorites() {
    GROUP_LETTERS.forEach((letter) => {
      const groupTeams = teams.filter((t) => t.group_letter === letter);
      const fav = groupTeams.find((t) => favorites.includes(t.fifa_code)) ?? groupTeams[0];
      const runner = groupTeams.find((t) => t.id !== fav?.id) ?? groupTeams[1];
      if (fav) {
        const el = document.querySelector(`select[name="groupWinner_${letter}"]`) as HTMLSelectElement;
        if (el) el.value = fav.id;
      }
      if (runner) {
        const el = document.querySelector(`select[name="groupRunnerUp_${letter}"]`) as HTMLSelectElement;
        if (el) el.value = runner.id;
      }
    });
    favTeams.slice(0, 4).forEach((t, i) => {
      const el = document.querySelector(`select[name="semifinalist_${i}"]`) as HTMLSelectElement;
      if (el) el.value = t.id;
    });
    favTeams.slice(0, 2).forEach((t, i) => {
      const el = document.querySelector(`select[name="finalist_${i}"]`) as HTMLSelectElement;
      if (el) el.value = t.id;
    });
    const champ = document.querySelector(`select[name="championTeamId"]`) as HTMLSelectElement;
    if (champ && favTeams[0]) champ.value = favTeams[0].id;
  }

  function randomPicks() {
    GROUP_LETTERS.forEach((letter) => {
      const groupTeams = teams.filter((t) => t.group_letter === letter);
      const shuffled = [...groupTeams].sort(() => Math.random() - 0.5);
      if (shuffled[0]) {
        const el = document.querySelector(`select[name="groupWinner_${letter}"]`) as HTMLSelectElement;
        if (el) el.value = shuffled[0].id;
      }
      if (shuffled[1]) {
        const el = document.querySelector(`select[name="groupRunnerUp_${letter}"]`) as HTMLSelectElement;
        if (el) el.value = shuffled[1].id;
      }
    });
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    shuffled.slice(0, 4).forEach((t, i) => {
      const el = document.querySelector(`select[name="semifinalist_${i}"]`) as HTMLSelectElement;
      if (el) el.value = t.id;
    });
    shuffled.slice(4, 6).forEach((t, i) => {
      const el = document.querySelector(`select[name="finalist_${i}"]`) as HTMLSelectElement;
      if (el) el.value = t.id;
    });
    const champ = document.querySelector(`select[name="championTeamId"]`) as HTMLSelectElement;
    if (champ) champ.value = shuffled[0]?.id ?? "";
  }

  function fireConfetti() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 }, colors: ["#D4AF37", "#C8102E", "#002868", "#006847", "#FFFFFF"] });
  }

  function handleBigSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveBigPicksAction(fd);
      if (result.error) setError(result.error);
      else {
        setSuccess(true);
        fireConfetti();
        setTimeout(() => setSuccess(false), 2000);
      }
    });
  }

  function handleFinalsSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveFinalsChallengeAction(fd);
      if (result.error) setError(result.error);
      else {
        setSuccess(true);
        fireConfetti();
        setTimeout(() => setSuccess(false), 2000);
      }
    });
  }

  const beforeCupLocked = bigLocked || firstMatchStarted;

  return (
    <div className="space-y-8">
      <PageHeader
        flags={["BRA", "ARG", "FRA", "ENG"]}
        title="Big Picks"
        subtitle="Tournament predictions · Before Cup + Finals Challenge"
      />

      {/* Before Cup */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="section-title">Before Cup</h2>
          {beforeCupLocked && <span className="badge badge-locked">🔒 Locked</span>}
        </div>

        {beforeCupLocked ? (
          <div className="card text-center text-ink-muted py-8">
            Before Cup picks are locked
          </div>
        ) : (
          <form onSubmit={handleBigSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              {GROUP_LETTERS.map((letter) => (
                <div key={letter} className="card space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-usa text-sm">Group {letter}</div>
                    <div className="flex gap-0.5">
                      {teams
                        .filter((t) => t.group_letter === letter)
                        .map((t) => (
                          <TeamFlag key={t.id} team={t} size="xs" />
                        ))}
                    </div>
                  </div>
                  <TeamSelect
                    name={`groupWinner_${letter}`}
                    label="Winner"
                    teams={teams.filter((t) => t.group_letter === letter)}
                    defaultValue={myBigPick?.group_winners?.[letter]}
                  />
                  <TeamSelect
                    name={`groupRunnerUp_${letter}`}
                    label="Runner-up"
                    teams={teams.filter((t) => t.group_letter === letter)}
                    defaultValue={myBigPick?.group_runners_up?.[letter]}
                  />
                </div>
              ))}
            </div>

            <div className="card space-y-3">
              <div className="card-title">Semifinalists (4)</div>
              {[0, 1, 2, 3].map((i) => (
                <TeamSelect
                  key={i}
                  name={`semifinalist_${i}`}
                  label={`SF ${i + 1}`}
                  teams={teams}
                  defaultValue={myBigPick?.semifinalists?.[i]}
                />
              ))}
            </div>

            <div className="card space-y-3">
              <div className="card-title">Finalists (2)</div>
              {[0, 1].map((i) => (
                <TeamSelect
                  key={i}
                  name={`finalist_${i}`}
                  label={`Finalist ${i + 1}`}
                  teams={teams}
                  defaultValue={myBigPick?.finalists?.[i]}
                />
              ))}
            </div>

            <div className="card space-y-3">
              <TeamSelect
                name="championTeamId"
                label="🏆 Champion"
                teams={teams}
                defaultValue={myBigPick?.champion_team_id ?? undefined}
              />
              <p className="text-xs text-mexico font-semibold text-center">
                Champion Bonus Available 🔥
              </p>
              <div>
                <label className="label">Top Scorer</label>
                <input
                  name="topScorer"
                  type="text"
                  defaultValue={myBigPick?.top_scorer ?? ""}
                  className="input-field"
                  placeholder="Player name"
                />
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={autoFavorites} className="btn-secondary flex-1 text-sm py-2.5">
                Auto Favorites
              </button>
              <button type="button" onClick={randomPicks} className="btn-secondary flex-1 text-sm py-2.5">
                Random Picks
              </button>
            </div>

            {error && <div className="alert-error">{error}</div>}

            <button type="submit" disabled={pending} className="btn-primary w-full">
              {pending ? "Saving..." : success ? "✅ Saved!" : "Save Big Picks"}
            </button>
          </form>
        )}
      </section>

      {/* Finals Challenge */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="section-title">Finals Challenge</h2>
          {!finalsOpen && <span className="badge badge-locked">🔒 Not open</span>}
        </div>

        {!finalsOpen ? (
          <div className="card text-center text-ink-muted py-8">
            Opens after group stage — admin will unlock
          </div>
        ) : (
          <form onSubmit={handleFinalsSave} className="space-y-4">
            <div className="card space-y-3">
              <div className="card-title">Quarterfinalists (8)</div>
              {Array.from({ length: 8 }, (_, i) => (
                <TeamSelect
                  key={i}
                  name={`qf_${i}`}
                  label={`QF ${i + 1}`}
                  teams={teams}
                  defaultValue={myFinalsPick?.quarterfinalists?.[i]}
                />
              ))}
            </div>

            <div className="card space-y-3">
              <div className="card-title">Semifinalists (4)</div>
              {Array.from({ length: 4 }, (_, i) => (
                <TeamSelect
                  key={i}
                  name={`sf_${i}`}
                  label={`SF ${i + 1}`}
                  teams={teams}
                  defaultValue={myFinalsPick?.semifinalists?.[i]}
                />
              ))}
            </div>

            <div className="card space-y-3">
              <div className="card-title">Finalists (2)</div>
              {[0, 1].map((i) => (
                <TeamSelect
                  key={i}
                  name={`finalist_${i}`}
                  label={`Finalist ${i + 1}`}
                  teams={teams}
                  defaultValue={myFinalsPick?.finalists?.[i]}
                />
              ))}
            </div>

            <div className="card">
              <TeamSelect
                name="championTeamId"
                label="🏆 Champion"
                teams={teams}
                defaultValue={myFinalsPick?.champion_team_id ?? undefined}
              />
            </div>

            {error && <div className="alert-error">{error}</div>}

            <button type="submit" disabled={pending} className="btn-primary w-full">
              {pending ? "Saving..." : success ? "✅ Saved!" : "Save Finals Challenge"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

function TeamSelect({
  name,
  label,
  teams,
  defaultValue,
}: {
  name: string;
  label: string;
  teams: Team[];
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="label flex items-center gap-2">
        {defaultValue && teams.find((t) => t.id === defaultValue) && (
          <TeamFlag team={teams.find((t) => t.id === defaultValue)} size="xs" />
        )}
        {label}
      </label>
      <select name={name} defaultValue={defaultValue ?? ""} className="input-field text-sm py-2.5">
        <option value="">— Select —</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.fifa_code} — {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
