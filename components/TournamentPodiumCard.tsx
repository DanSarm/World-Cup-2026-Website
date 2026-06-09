"use client";

import type { ReactNode } from "react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveTournamentPodiumAction } from "@/lib/actions";
import {
  previewPodiumPlacePoints,
  PODIUM_FORM_PLACE,
} from "@/lib/podiumPreview";
import type { FlagSize } from "@/lib/flags";
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
  /** Rendered beside the podium card (e.g. champion odds on home) */
  companion?: ReactNode;
}

const PLACES = [
  {
    key: "firstPlaceTeamId",
    label: "1st Place",
    medal: "🥇",
    field: "first_place_team_id" as const,
    tier: "first" as const,
    flagSize: "lg" as FlagSize,
  },
  {
    key: "secondPlaceTeamId",
    label: "2nd Place",
    medal: "🥈",
    field: "second_place_team_id" as const,
    tier: "second" as const,
    flagSize: "md" as FlagSize,
  },
  {
    key: "thirdPlaceTeamId",
    label: "3rd Place",
    medal: "🥉",
    field: "third_place_team_id" as const,
    tier: "third" as const,
    flagSize: "sm" as FlagSize,
  },
];

export function TournamentPodiumCard({
  teams,
  myPodium,
  locked,
  worldCupKickoff,
  championProbabilities,
  companion,
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

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
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
          <PickCountdownBadge kickoffAt={worldCupKickoff} label="until WC" />
        )}
        {confirmed && (
          <span className="badge badge-locked shrink-0">🔒 Locked in</span>
        )}
        {locked && !confirmed && (
          <span className="badge badge-locked shrink-0">🔒 Closed</span>
        )}
      </div>
    </div>
  );

  const readOnlyBody = (
    <PodiumPicksDisplay
      teams={teams}
      myPodium={myPodium}
      championProbabilities={championProbabilities}
      fillHeight={!!companion}
      locked={locked}
    />
  );

  const editBody = (
    <>
      <p className="text-sm text-ink-muted">
        Predict who finishes 1st, 2nd, and 3rd. Once saved, your picks cannot
        be changed.
      </p>

      {PLACES.map(({ key, label, medal }) => {
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
    </>
  );

  const bodyContent = readOnly ? readOnlyBody : editBody;
  const bodyClassName = readOnly ? undefined : "space-y-4";
  const cardClassName = companion
    ? `home-podium-card card flex flex-col flex-1 min-w-0 h-full min-h-0 overflow-hidden ${
        readOnly ? "p-0" : "overflow-y-auto"
      } ${bodyClassName ?? ""}`
    : `card ${readOnly ? "p-0 overflow-hidden" : ""} ${bodyClassName ?? "space-y-3"}`;

  return (
    <>
      <section className="space-y-3">
        <div className="px-0.5">{header}</div>
        <div
          className={
            companion
              ? "home-podium-pair flex flex-col xl:flex-row xl:items-stretch gap-4 xl:gap-5"
              : undefined
          }
        >
          {readOnly ? (
            <div className={cardClassName}>{bodyContent}</div>
          ) : (
            <form ref={formRef} className={cardClassName}>
              {bodyContent}
            </form>
          )}
          {companion}
        </div>
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

function PodiumPicksDisplay({
  teams,
  myPodium,
  championProbabilities,
  fillHeight,
  locked,
}: {
  teams: Team[];
  myPodium?: TournamentPodiumPrediction | null;
  championProbabilities?: Record<string, number>;
  fillHeight: boolean;
  locked: boolean;
}) {
  const containerClass = fillHeight
    ? "home-podium-picks flex flex-col flex-1 min-h-0"
    : "divide-y divide-ink/[0.06]";

  return (
    <div className={containerClass}>
      {PLACES.map(({ label, medal, field, key, tier, flagSize }) => {
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
          <div
            key={field}
            className={
              fillHeight
                ? `home-podium-place home-podium-place--${tier}`
                : `home-podium-place home-podium-place--${tier} home-podium-place--compact`
            }
          >
            <span
              className={`home-podium-place-medal home-podium-place-medal--${tier}`}
            >
              {medal}
            </span>
            {team ? (
              <>
                <TeamFlag team={team} size={flagSize} />
                <div className="flex-1 min-w-0">
                  <TeamCode
                    code={team.fifa_code}
                    prominent={tier === "first"}
                    className={`home-podium-place-code home-podium-place-code--${tier}`}
                  />
                  <p
                    className={`home-podium-place-label home-podium-place-label--${tier}`}
                  >
                    {label}
                  </p>
                </div>
                {maxPts != null && (
                  <PodiumPointsHint points={maxPts} tier={tier} />
                )}
              </>
            ) : (
              <span className="text-sm text-ink-faint">{label} — not picked</span>
            )}
          </div>
        );
      })}
      {locked && !myPodium?.first_place_team_id && (
        <p className="text-sm text-ink-muted text-center px-5 py-4 border-t border-ink/[0.06]">
          Podium picks closed — you didn&apos;t submit in time
        </p>
      )}
    </div>
  );
}

function PodiumPointsHint({
  points,
  tier = "third",
}: {
  points: number;
  tier?: "first" | "second" | "third";
}) {
  return (
    <span
      className={`home-podium-points home-podium-points--${tier} tabular-nums shrink-0`}
      title={`+${points} if correct`}
    >
      +{points}
      <span className="home-podium-points-suffix"> if correct</span>
    </span>
  );
}
