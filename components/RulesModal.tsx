"use client";

import { useState } from "react";

interface RulesModalProps {
  variant?: "default" | "mobile";
}

export function RulesModal({ variant = "default" }: RulesModalProps) {
  const [open, setOpen] = useState(false);

  const triggerClass =
    variant === "mobile"
      ? "text-xs font-semibold px-3 py-1.5 rounded-full bg-white/10 text-white/80 border border-white/10 backdrop-blur-sm"
      : "text-sm font-medium text-white/50 hover:text-white/90 transition-colors";

  return (
    <>
      <button onClick={() => setOpen(true)} className={triggerClass} type="button">
        Rules
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="card max-w-sm w-full space-y-4 animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">📋</span>
              <h2 className="text-xl font-bold text-pitch-900">Pool Rules</h2>
            </div>
            <ul className="space-y-3 text-sm text-ink-muted">
              {[
                ["💰", "$40 entry. No extra bets."],
                ["⚽", "Pick every score."],
                ["✅", "Correct result = points."],
                ["🎯", "Exact score = bonus."],
                ["🔥", "Hard picks get bonus points."],
                ["🔥", "Crazy exact scores get fire bonus."],
                ["🔒", "Picks lock at kickoff."],
                ["🏆", "Most points wins."],
              ].map(([icon, text]) => (
                <li key={text} className="flex items-center gap-3">
                  <span className="text-lg w-6 text-center">{icon}</span>
                  <span className="text-ink">{text}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-faint pt-2 border-t border-ink/5">
              Private friends/family pool. Admin tracks payments outside the app.
            </p>
            <button
              onClick={() => setOpen(false)}
              className="btn-primary"
              type="button"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
