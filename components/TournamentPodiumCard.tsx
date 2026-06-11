"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FlagSize } from "@/lib/flags";
import { saveTournamentPodiumPlaceAction } from "@/lib/actions";
import { previewPodiumPlacePoints, PODIUM_FORM_PLACE } from "@/lib/podiumPreview";
import { calculateTeamTournamentValue } from "@/lib/tournamentValue";
import { isPodiumIncomplete } from "@/lib/pickUtils";
import { TeamFlag } from "./Flag";
import { PickCountdownBadge } from "./PickCountdown";
import { PlaceMedal } from "./PlaceMedal";
import { UrgentPill } from "./UrgentPill";
import type { Team, TournamentPodiumPrediction } from "@/lib/types";

interface TournamentPodiumCardProps {
  teams: Team[];
  myPodium?: TournamentPodiumPrediction | null;
  /** Admin lock or World Cup already started */
  locked: boolean;
  worldCupKickoff: string | null;
  companion?: ReactNode;
  companionOutside?: ReactNode;
}

type PlaceKey = (typeof PLACES)[number]["key"];

const PLACES = [
  {
    key: "firstPlaceTeamId",
    label: "Champion",
    field: "first_place_team_id" as const,
    tier: "first" as const,
    flagSize: "lg" as FlagSize,
  },
  {
    key: "secondPlaceTeamId",
    label: "Runner-up",
    field: "second_place_team_id" as const,
    tier: "second" as const,
    flagSize: "md" as FlagSize,
  },
  {
    key: "thirdPlaceTeamId",
    label: "Third Place",
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
  companion,
  companionOutside,
}: TournamentPodiumCardProps) {
  const confirmed = myPodium?.podium_confirmed === true;
  const podiumUrgent = !locked && isPodiumIncomplete(myPodium);
  const hasOutsideRail = !!companionOutside;
  const hasCompanionLayout = !!companion || hasOutsideRail;

  const header = (
    <div className="home-podium-header flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 min-w-0 flex-wrap">
        <h2 className="section-title min-w-0">Tournament Picks</h2>
        {podiumUrgent && <UrgentPill />}
      </div>
      <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
        {!locked && worldCupKickoff && (
          <PickCountdownBadge kickoffAt={worldCupKickoff} label="until WC" />
        )}
        {locked && <span className="badge badge-locked">Closed</span>}
        {confirmed && !locked && !podiumUrgent && (
          <span className="badge badge-open">Saved</span>
        )}
      </div>
    </div>
  );

  const cardClassName = hasCompanionLayout
    ? "home-podium-card card flex flex-col flex-1 min-w-0 h-full min-h-0 overflow-hidden p-0"
    : "card overflow-hidden p-0";

  const cardBody = (
    <div key="picks-body" className={cardClassName}>
      <PodiumPicksDisplay
        teams={teams}
        myPodium={myPodium}
        fillHeight={hasCompanionLayout}
        locked={locked}
      />
    </div>
  );

  return (
    <section className={`space-y-3${hasOutsideRail ? " overflow-visible" : ""}`}>
      <div className="px-0.5">{header}</div>
      {companionOutside ? (
        <div className="home-podium-with-rail relative">
          {cardBody}
          <aside key="champion-odds" className="home-podium-rail-outside">
            {companionOutside}
          </aside>
        </div>
      ) : (
        <div
          className={
            companion
              ? "home-podium-pair flex flex-col xl:flex-row xl:items-stretch gap-4 xl:gap-5"
              : undefined
          }
        >
          {cardBody}
          {companion}
        </div>
      )}
    </section>
  );
}

function PodiumPicksDisplay({
  teams,
  myPodium,
  fillHeight,
  locked,
}: {
  teams: Team[];
  myPodium?: TournamentPodiumPrediction | null;
  fillHeight: boolean;
  locked: boolean;
}) {
  const [editingKey, setEditingKey] = useState<PlaceKey | null>(null);

  const containerClass = fillHeight
    ? "home-podium-picks flex flex-col flex-1 min-h-0"
    : "divide-y divide-ink/[0.06]";

  const selectedByKey: Record<PlaceKey, string | null> = useMemo(
    () => ({
      firstPlaceTeamId: myPodium?.first_place_team_id ?? null,
      secondPlaceTeamId: myPodium?.second_place_team_id ?? null,
      thirdPlaceTeamId: myPodium?.third_place_team_id ?? null,
    }),
    [myPodium]
  );

  return (
    <div className={containerClass}>
      {PLACES.map((place) => (
        <PodiumPlaceRow
          key={place.field}
          place={place}
          teams={teams}
          teamId={selectedByKey[place.key]}
          otherSelectedIds={PLACES.filter((p) => p.key !== place.key).map(
            (p) => selectedByKey[p.key]
          )}
          fillHeight={fillHeight}
          locked={locked}
          editing={editingKey === place.key}
          onStartEdit={() => setEditingKey(place.key)}
          onEndEdit={() => setEditingKey(null)}
        />
      ))}
      {locked && !myPodium?.first_place_team_id && (
        <p className="text-sm text-ink-muted text-center px-5 py-4 border-t border-ink/[0.06]">
          Podium picks closed — you didn&apos;t submit in time
        </p>
      )}
    </div>
  );
}

function PodiumPlaceRow({
  place,
  teams,
  teamId,
  otherSelectedIds,
  fillHeight,
  locked,
  editing,
  onStartEdit,
  onEndEdit,
}: {
  place: (typeof PLACES)[number];
  teams: Team[];
  teamId: string | null;
  otherSelectedIds: (string | null)[];
  fillHeight: boolean;
  locked: boolean;
  editing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
}) {
  const router = useRouter();
  const rowRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [previewTeamId, setPreviewTeamId] = useState<string | null>(teamId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sortedTeams = useMemo(
    () =>
      [...teams]
        .filter(
          (t) =>
            t.id === teamId || !otherSelectedIds.some((id) => id === t.id)
        )
        .sort((a, b) => {
          const aVal = calculateTeamTournamentValue(a) || Infinity;
          const bVal = calculateTeamTournamentValue(b) || Infinity;
          if (aVal !== bVal) return aVal - bVal;
          return a.fifa_code.localeCompare(b.fifa_code);
        }),
    [teams, teamId, otherSelectedIds]
  );

  const displayTeamId = editing ? previewTeamId : teamId;
  const displayTeam = displayTeamId
    ? teams.find((t) => t.id === displayTeamId) ?? null
    : null;
  const displayPts = displayTeam
    ? previewPodiumPlacePoints(PODIUM_FORM_PLACE[place.key], displayTeam)
    : null;

  useEffect(() => {
    if (!editing) setPreviewTeamId(teamId);
  }, [teamId, editing]);

  const cancelEdit = useCallback(() => {
    setPreviewTeamId(teamId);
    setError(null);
    onEndEdit();
  }, [teamId, onEndEdit]);

  const beginEdit = useCallback(() => {
    if (locked || pending) return;
    setError(null);
    setPreviewTeamId(teamId ?? sortedTeams[0]?.id ?? null);
    onStartEdit();
  }, [locked, pending, teamId, sortedTeams, onStartEdit]);

  const previewTeam = useCallback((id: string) => {
    setPreviewTeamId(id);
  }, []);

  const updatePreviewFromScroll = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const rect = list.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const options = list.querySelectorAll<HTMLElement>("[data-podium-option]");
    let closestId: string | null = null;
    let closestDist = Infinity;
    for (const opt of options) {
      const r = opt.getBoundingClientRect();
      const center = r.top + r.height / 2;
      const dist = Math.abs(center - midY);
      if (dist < closestDist) {
        closestDist = dist;
        closestId = opt.dataset.teamId ?? null;
      }
    }
    if (closestId) setPreviewTeamId(closestId);
  }, []);

  const commitTeam = useCallback(
    (id: string) => {
      if (pending) return;
      setError(null);
      startTransition(async () => {
        const result = await saveTournamentPodiumPlaceAction(place.key, id);
        if (result.error) {
          setError(result.error);
          return;
        }
        setPreviewTeamId(id);
        onEndEdit();
        router.refresh();
      });
    },
    [pending, place.key, onEndEdit, router]
  );

  useEffect(() => {
    if (!editing) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = sortedTeams.findIndex((t) => t.id === previewTeamId);
        const base = idx >= 0 ? idx : 0;
        const next =
          e.key === "ArrowDown"
            ? Math.min(base + 1, sortedTeams.length - 1)
            : Math.max(base - 1, 0);
        const nextId = sortedTeams[next]?.id;
        if (!nextId) return;
        setPreviewTeamId(nextId);
        listRef.current
          ?.querySelector<HTMLElement>(`[data-team-id="${nextId}"]`)
          ?.scrollIntoView({ block: "nearest" });
        return;
      }
      if (e.key === "Enter" && previewTeamId) {
        e.preventDefault();
        commitTeam(previewTeamId);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    editing,
    cancelEdit,
    sortedTeams,
    previewTeamId,
    commitTeam,
  ]);

  useEffect(() => {
    if (!editing) return;
    rowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (!previewTeamId) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-team-id="${previewTeamId}"]`)
      ?.scrollIntoView({ block: "nearest" });
    // Scroll active option into view when edit opens only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const rowClass = fillHeight
    ? `home-podium-place home-podium-place--${place.tier}`
    : `home-podium-place home-podium-place--${place.tier} home-podium-place--compact`;

  return (
    <div
      ref={rowRef}
      className={`${rowClass}${editing ? " home-podium-place--editing" : ""}`}
    >
      <span
        className={`home-podium-place-medal home-podium-place-medal--${place.tier}`}
      >
        <PlaceMedal tier={place.tier} trophySize="podium" />
      </span>

      <div className="home-podium-place-flag">
        {displayTeam ? (
          <TeamFlag team={displayTeam} size={place.flagSize} />
        ) : (
          <span
            className={`home-podium-place-flag-empty home-podium-place-flag-empty--${place.tier}`}
            aria-hidden
          />
        )}
      </div>

      {!editing ? (
        <p
          className={`home-podium-place-name home-podium-place-name--${place.tier}`}
        >
          {displayTeam
            ? displayTeam.short_name || displayTeam.name
            : `${place.label} — not picked`}
        </p>
      ) : (
        <p className="home-podium-place-hint" aria-hidden>
          Scroll to preview · tap to save
        </p>
      )}

      <div className="home-podium-place-actions">
        {displayPts != null && (
          <PodiumPointsHint
            points={displayPts}
            tier={place.tier}
            preview={editing}
          />
        )}
        {editing ? (
          <button
            type="button"
            onClick={cancelEdit}
            disabled={pending}
            className="home-podium-cancel-btn"
          >
            Cancel
          </button>
        ) : (
          !locked && (
            <button
              type="button"
              onClick={beginEdit}
              className="home-podium-edit-btn"
              aria-label={`Edit ${place.label}`}
            >
              Edit
            </button>
          )
        )}
      </div>

      {editing && (
        <div
          ref={listRef}
          className="home-podium-picker"
          role="listbox"
          aria-label={`Pick ${place.label}`}
          onScroll={updatePreviewFromScroll}
        >
          {sortedTeams.map((t) => {
            const isPreview = t.id === previewTeamId;
            return (
              <button
                key={t.id}
                type="button"
                data-podium-option
                data-team-id={t.id}
                role="option"
                aria-selected={isPreview}
                disabled={pending}
                className={`home-podium-picker-option home-podium-picker-option--${place.tier}${
                  isPreview ? " home-podium-picker-option--preview" : ""
                }`}
                onMouseEnter={() => previewTeam(t.id)}
                onFocus={() => previewTeam(t.id)}
                onPointerDown={() => previewTeam(t.id)}
                onTouchStart={() => previewTeam(t.id)}
                onClick={() => commitTeam(t.id)}
              >
                {t.short_name || t.name}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p className="home-podium-place-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function PodiumPointsHint({
  points,
  tier = "third",
  preview = false,
}: {
  points: number;
  tier?: "first" | "second" | "third";
  preview?: boolean;
}) {
  return (
    <span
      className={`home-podium-points home-podium-points--${tier} tabular-nums${
        preview ? " home-podium-points--preview" : ""
      }`}
      title={`+${points} pts`}
    >
      +{points} pts
    </span>
  );
}
