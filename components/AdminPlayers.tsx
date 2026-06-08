"use client";



import { useState, useTransition } from "react";

import {

  adminTogglePaidAction,

  adminToggleAdminAction,

  adminAdjustPointsAction,

} from "@/lib/actions";

import type { Player } from "@/lib/types";



export function AdminPlayers({ players }: { players: Player[] }) {

  const [pending, startTransition] = useTransition();

  const [adjustPlayer, setAdjustPlayer] = useState<string | null>(null);

  const [message, setMessage] = useState<string | null>(null);



  function togglePaid(id: string, paid: boolean) {

    startTransition(async () => {

      await adminTogglePaidAction(id, !paid);

    });

  }



  function toggleAdmin(id: string, isAdmin: boolean) {

    startTransition(async () => {

      await adminToggleAdminAction(id, !isAdmin);

    });

  }



  function handleAdjust(e: React.FormEvent<HTMLFormElement>) {

    e.preventDefault();

    const fd = new FormData(e.currentTarget);

    startTransition(async () => {

      const result = await adminAdjustPointsAction(fd);

      setMessage(result.error ?? "Adjusted!");

      setAdjustPlayer(null);

    });

  }



  return (

    <div className="space-y-3">

      {players.map((p) => (

        <div key={p.id} className="card flex items-center justify-between gap-2 p-4">

          <div>

            <span className="font-bold text-ink">{p.avatar_emoji} {p.display_name}</span>

            {p.is_admin && (

              <span className="ml-2 badge badge-final text-[10px]">Admin</span>

            )}

          </div>

          <div className="flex gap-2 flex-wrap justify-end">

            <button

              type="button"

              disabled={pending}

              onClick={() => togglePaid(p.id, p.paid)}

              className={`btn-chip ${p.paid ? "btn-chip-success" : "btn-chip-warning"}`}

            >

              {p.paid ? "Paid ✅" : "Unpaid"}

            </button>

            <button

              type="button"

              disabled={pending}

              onClick={() => toggleAdmin(p.id, p.is_admin)}

              className="btn-chip btn-chip-neutral"

            >

              {p.is_admin ? "Remove Admin" : "Make Admin"}

            </button>

            <button

              type="button"

              onClick={() => setAdjustPlayer(p.id)}

              className="btn-chip btn-chip-accent"

            >

              Adjust

            </button>

          </div>

        </div>

      ))}



      {adjustPlayer && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">

          <form onSubmit={handleAdjust} className="card max-w-sm w-full space-y-3">

            <h3 className="card-title text-base">Adjust Points</h3>

            <input type="hidden" name="playerId" value={adjustPlayer} />

            <input name="points" type="number" required className="input-field" placeholder="Points (+/-)" />

            <input name="reason" type="text" required className="input-field" placeholder="Reason" />

            {message && <p className="text-success">{message}</p>}

            <div className="flex gap-2">

              <button type="button" onClick={() => setAdjustPlayer(null)} className="btn-secondary flex-1">Cancel</button>

              <button type="submit" disabled={pending} className="btn-primary flex-1">Save</button>

            </div>

          </form>

        </div>

      )}

    </div>

  );

}

