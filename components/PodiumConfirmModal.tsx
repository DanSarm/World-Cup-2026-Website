"use client";

import { PlaceMedal, type PlaceTier } from "./PlaceMedal";
import { TeamFlag } from "./Flag";
import { TeamCode } from "./TeamCode";
import type { Team } from "@/lib/types";

export function PodiumConfirmModal({
  open,
  picks,
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  picks: { tier: PlaceTier; label: string; team: Team; maxPoints: number }[];
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="card w-full max-w-sm space-y-4 shadow-2xl animate-in rounded-2xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="podium-confirm-title"
      >
        <div className="flex items-start gap-3">
          <span className="text-3xl shrink-0" aria-hidden>
            ⚠️
          </span>
          <div className="space-y-1 min-w-0">
            <h2
              id="podium-confirm-title"
              className="text-lg font-extrabold text-usa leading-tight"
            >
              Save your podium picks?
            </h2>
            <p className="text-sm text-ink-muted leading-relaxed">
              You can update these anytime until the first match kicks off.
              After that, picks close for the whole tournament.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-cream/80 border border-ink/5 divide-y divide-ink/5 overflow-hidden">
          {picks.map(({ tier, label, team, maxPoints }) => (
            <div key={label} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-7 shrink-0 flex items-center justify-center">
                <PlaceMedal tier={tier} trophySize="compact" />
              </span>
              <TeamFlag team={team} size="sm" />
              <div className="min-w-0 flex-1">
                <TeamCode code={team.fifa_code} className="!text-sm text-ink" />
                <p className="text-[11px] text-ink-muted">{label}</p>
              </div>
              <span className="text-[10px] font-medium text-ink-faint tabular-nums shrink-0">
                +{maxPoints} if correct
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="btn-secondary flex-1 py-3"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="btn-primary flex-1 py-3"
          >
            {pending ? "Saving..." : "Yes, save picks"}
          </button>
        </div>
      </div>
    </div>
  );
}
