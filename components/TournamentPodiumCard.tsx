"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveTournamentPodiumAction } from "@/lib/actions";
import {
  previewPodiumPlacePoints,
  PODIUM_FORM_PLACE,
} from "@/lib/podiumPreview";
import { TeamFlag } from "./Flag";
import { TeamCode } from "./TeamCode";
import { PickCountdownBadge } from "./PickCountdown";
import { PodiumConfirmModal } from "./PodiumConfirmModal";
import type { Team, TournamentPodiumPrediction } from "@/lib/types";

interface TournamentPodiumCardProps {
  teams: Team[];
  myPodium?: TournamentPodiumPrediction | null;
  /** Admin lock or World Cup already started */
  locked: boolean;
  worldCupKickoff: string | null;
  championProbabilities?: Record<string, number>;
}

const PLACES = [
  {
    key: "firstPlaceTeamId",
    label: "1st Place",
    medal: "🥇",
    field: "first_place_team_id" as const,
  },
  {
    key: "secondPlaceTeamId",
    label: "2nd Place",
    medal: "🥈",
    field: "second_place_team_id" as const,
  },
  {
    key: "thirdPlaceTeamId",
    label: "3rd Place",
    medal: "🥉",
    field: "third_place_team_id" as const,
  },
];

export function TournamentPodiumCard({
  teams,
  myPodium,
  locked,
  worldCupKickoff,
  championProbabilities,
}: TournamentPodiumCardProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmPicks, setConfirmPicks] = useState<
    { medal: string; label: string; team: Team; maxPoints: number }[]
  >([]);
  const [pendingForm, setPendingForm] = useState<FormData | null>(null);
  const [pending, startTransition] = useTransition();
  const [selections, setSelections] = useState<Record<string, string>>(() => ({
    firstPlaceTeamId: myPodium?.first_place_team_id ?? "",
    secondPlaceTeamId: myPodium?.second_place_team_id ?? "",
    thirdPlaceTeamId: myPodium?.third_place_team_id ?? "",
  }));

  const sortedTeams = [...teams].sort((a, b) =>
    a.fifa_code.localeCompare(b.fifa_code)
  );

  const confirmed = myPodium?.podium_confirmed === true;
  const readOnly = locked || confirmed;

  function openConfirm() {
    setError(null);
    const form = formRef.current;
    if (!form?.reportValidity()) return;

    const fd = new FormData(form);
    const picks: { medal: string; label: string; team: Team; maxPoints: number }[] = [];

    for (const place of PLACES) {
      const teamId = fd.get(place.key) as string;
      const team = teams.find((t) => t.id === teamId);
      if (!team) {
        setError("Pick a team for each place");
        return;
      }
      picks.push({
        medal: place.medal,
        label: place.label,
        team,
        maxPoints: previewPodiumPlacePoints(
          PODIUM_FORM_PLACE[place.key],
          teamId,
          championProbabilities
        ),
      });
    }

    setConfirmPicks(picks);
    setPendingForm(fd);
    setShowConfirm(true);
  }

  function handleConfirmSave() {
    if (!pendingForm) return;
    startTransition(async () => {
      const result = await saveTournamentPodiumAction(pendingForm);
      if (result.error) {
        setError(result.error);
        setShowConfirm(false);
        return;
      }
      setShowConfirm(false);
      setPendingForm(null);
      router.refresh();
    });
  }

  return (
    <>
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3 px-0.5">
          <div className="space-y-0.5 min-w-0">
            <h2 className="section-title">Tournament Podium</h2>
            {!readOnly && (
              <p className="text-xs text-ink-muted">
                Pick 1st, 2nd & 3rd before the World Cup starts
              </p>
            )}
          </div>
          <div className="flex items-start gap-2 shrink-0">
            {!readOnly && worldCupKickoff && (
              <PickCountdownBadge
                kickoffAt={worldCupKickoff}
                label="until WC"
              />
            )}
            {confirmed && (
              <span className="badge badge-locked shrink-0">🔒 Locked in</span>
            )}
            {locked && !confirmed && (
              <span className="badge badge-locked shrink-0">🔒 Closed</span>
            )}
          </div>
        </div>

        {readOnly ? (
          <div className="card space-y-3">
            {PLACES.map(({ label, medal, field, key }) => {
              const teamId = myPodium?.[field];
              const team = teamId ? teams.find((t) => t.id === teamId) : null;
              const maxPts =
                team && teamId
                  ? previewPodiumPlacePoints(
                      PODIUM_FORM_PLACE[key],
                      teamId,
                      championProbabilities
                    )
                  : null;
              return (
                <div key={field} className="flex items-center gap-3 py-1">
                  <span className="text-xl w-8 text-center shrink-0">{medal}</span>
                  {team ? (
                    <>
                      <TeamFlag team={team} size="sm" />
                      <div className="flex-1 min-w-0">
                        <TeamCode code={team.fifa_code} prominent className="text-ink" />
                        <p className="text-xs text-ink-muted">{label}</p>
                      </div>
                      {maxPts != null && (
                        <PodiumPointsHint points={maxPts} />
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-ink-faint">
                      {label} — not picked
                    </span>
                  )}
                </div>
              );
            })}
            {locked && !myPodium?.first_place_team_id && (
              <p className="text-sm text-ink-muted text-center pt-2">
                Podium picks closed — you didn&apos;t submit in time
              </p>
            )}
          </div>
        ) : (
          <form ref={formRef} className="card space-y-4">
            <p className="text-sm text-ink-muted">
              Predict who finishes 1st, 2nd, and 3rd. Once saved, your picks
              cannot be changed.
            </p>

            {PLACES.map(({ key, label, medal, field }) => {
              const selectedId = selections[key];
              const selected = teams.find((t) => t.id === selectedId);
              const maxPts = selectedId
                ? previewPodiumPlacePoints(
                    PODIUM_FORM_PLACE[key],
                    selectedId,
                    championProbabilities
                  )
                : null;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="label flex items-center gap-2 mb-0">
                      <span>{medal}</span>
                      {selected && <TeamFlag team={selected} size="xs" />}
                      {label}
                    </label>
                    {maxPts != null && <PodiumPointsHint points={maxPts} />}
                  </div>
                  <select
                    name={key}
                    value={selectedId}
                    onChange={(e) =>
                      setSelections((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    required
                    className="input-field text-sm py-2.5"
                  >
                    <option value="">— Select team —</option>
                    {sortedTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fifa_code} — {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}

            {error && <div className="alert-error">{error}</div>}

            <button
              type="button"
              onClick={openConfirm}
              disabled={pending}
              className="btn-primary w-full"
            >
              Save Podium Picks
            </button>
          </form>
        )}
      </section>

      <PodiumConfirmModal
        open={showConfirm}
        picks={confirmPicks}
        pending={pending}
        onConfirm={handleConfirmSave}
        onCancel={() => {
          if (!pending) {
            setShowConfirm(false);
            setPendingForm(null);
          }
        }}
      />
    </>
  );
}

function PodiumPointsHint({ points }: { points: number }) {
  return (
    <span className="text-[10px] font-medium text-ink-faint tabular-nums shrink-0">
      +{points} if correct
    </span>
  );
}
