"use client";

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
  picks: { medal: string; label: string; team: Team }[];
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
              Lock in your podium?
            </h2>
            <p className="text-sm text-ink-muted leading-relaxed">
              You won&apos;t be able to change these picks after saving. Make
              sure you&apos;re happy with your choices.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-cream/80 border border-ink/5 divide-y divide-ink/5 overflow-hidden">
          {picks.map(({ medal, label, team }) => (
            <div key={label} className="flex items-center gap-3 px-3 py-2.5">
              <span className="text-lg w-7 text-center shrink-0">{medal}</span>
              <TeamFlag team={team} size="sm" />
              <div className="min-w-0 flex-1">
                <TeamCode code={team.fifa_code} className="!text-sm text-ink" />
                <p className="text-[11px] text-ink-muted">{label}</p>
              </div>
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
            {pending ? "Saving..." : "Yes, lock it in"}
          </button>
        </div>
      </div>
    </div>
  );
}
