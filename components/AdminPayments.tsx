"use client";

import { useTransition } from "react";
import { adminTogglePaidAction } from "@/lib/actions";
import { formatMoney, POOL_ENTRY_FEE } from "@/lib/payouts";
import type { Player } from "@/lib/types";
import { PageHeader } from "./PageHeader";

interface AdminPaymentsProps {
  players: Player[];
  prizePool: number;
}

export function AdminPayments({ players, prizePool }: AdminPaymentsProps) {
  const [pending, startTransition] = useTransition();

  function togglePaid(id: string, paid: boolean) {
    startTransition(async () => {
      await adminTogglePaidAction(id, !paid);
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

      <ul className="space-y-2">
        {players.map((player) => (
          <li key={player.id}>
            <label
              className={`card flex items-center gap-3 p-4 cursor-pointer transition-colors ${
                player.paid ? "ring-1 ring-mexico/30" : ""
              } ${pending ? "opacity-70 pointer-events-none" : ""}`}
            >
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
              {player.paid && (
                <span className="ml-auto text-sm font-bold text-mexico tabular-nums shrink-0">
                  +{formatMoney(POOL_ENTRY_FEE)}
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>

      {players.length === 0 && (
        <p className="text-center text-ink-faint py-8 text-sm">No players yet</p>
      )}
    </div>
  );
}
