"use client";

import { useState, useTransition } from "react";
import { adminTogglePaidAction, adminDeletePlayerAction } from "@/lib/actions";
import { formatMoney, POOL_ENTRY_FEE } from "@/lib/payouts";
import type { Player } from "@/lib/types";
import { PageHeader } from "./PageHeader";

interface AdminPaymentsProps {
  players: Player[];
  prizePool: number;
}

export function AdminPayments({ players, prizePool }: AdminPaymentsProps) {
  const [pending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function togglePaid(id: string, paid: boolean) {
    startTransition(async () => {
      await adminTogglePaidAction(id, !paid);
    });
  }

  function removePlayer(player: Player) {
    const confirmed = window.confirm(
      `Remove ${player.display_name} from the site?\n\nThis permanently deletes their account, match picks, and tournament picks. This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleteError(null);
    startTransition(async () => {
      const result = await adminDeletePlayerAction(player.id);
      if (result?.error) setDeleteError(result.error);
    });
  }

  const paidCount = players.filter((p) => p.paid).length;

  return (
    <div className="space-y-6">
      <PageHeader
        emoji="💵"
        title="Payments"
        subtitle="Check off each player when they pay you $50"
        prizePool={prizePool}
      />

      <div className="card p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
            Collected
          </p>
          <p className="text-sm text-ink-faint mt-0.5">
            {paidCount} of {players.length} paid ·{" "}
            {formatMoney(POOL_ENTRY_FEE)} each
          </p>
        </div>
        <p className="text-2xl font-extrabold text-usa tabular-nums">
          {formatMoney(prizePool)}
        </p>
      </div>

      {deleteError && (
        <p className="text-sm font-semibold text-canada">{deleteError}</p>
      )}

      <ul className="space-y-2">
        {players.map((player) => (
          <li key={player.id}>
            <div
              className={`card flex items-center gap-3 p-4 transition-colors ${
                player.paid ? "ring-1 ring-mexico/30" : ""
              } ${pending ? "opacity-70 pointer-events-none" : ""}`}
            >
              <label className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={player.paid}
                  disabled={pending}
                  onChange={() => togglePaid(player.id, player.paid)}
                  className="h-5 w-5 shrink-0 rounded border-ink/20 text-usa focus:ring-usa/30"
                />
                <span className="font-semibold text-ink flex items-center gap-2 min-w-0">
                  <span aria-hidden>{player.avatar_emoji}</span>
                  <span className="truncate">{player.display_name}</span>
                </span>
              </label>
              {player.paid && (
                <span className="ml-auto text-sm font-bold text-mexico tabular-nums shrink-0">
                  +{formatMoney(POOL_ENTRY_FEE)}
                </span>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => removePlayer(player)}
                aria-label={`Remove ${player.display_name}`}
                className={`shrink-0 text-xs font-bold uppercase tracking-wide text-canada/70 hover:text-canada hover:bg-canada/10 px-2.5 py-1.5 rounded-lg transition-colors ${
                  player.paid ? "" : "ml-auto"
                }`}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      {players.length === 0 && (
        <p className="text-center text-ink-faint py-8 text-sm">No players yet</p>
      )}
    </div>
  );
}
