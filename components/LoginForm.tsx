"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerAction, loginAction } from "@/lib/actions";
import { GROUP_LETTERS } from "@/lib/types";
import type { TeamOption } from "@/lib/teamsData";
import { SiteLogo } from "./SiteLogo";

interface LoginPageProps {
  teams: TeamOption[];
  isRegister?: boolean;
}

export function LoginForm({ teams, isRegister: initialRegister }: LoginPageProps) {
  const [isRegister, setIsRegister] = useState(initialRegister ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = isRegister
        ? await registerAction(fd)
        : await loginAction(fd);
      if (result.error) setError(result.error);
      else {
        router.push("/");
        router.refresh();
      }
    });
  }

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center py-8">
      <div className="text-center space-y-3 mb-8">
        <SiteLogo size="hero" />
        <h1 className="text-3xl font-extrabold text-gold-gradient tracking-tight">
          Family Cup 2026
        </h1>
        <p className="text-on-dark-muted text-sm">Pick scores. Win points.</p>
      </div>

      <div className="card w-full max-w-sm space-y-5">
        <p className="text-center text-sm text-ink-muted">
          {isRegister
            ? "First time? Create your account."
            : "Welcome back — sign in with name + PIN."}
        </p>

        <div className="segmented-light">
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(null); }}
            className={`segment-light flex-1 ${!isRegister ? "segment-light-active" : ""}`}
          >
            Enter
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(null); }}
            className={`segment-light flex-1 ${isRegister ? "segment-light-active" : ""}`}
          >
            Join
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="label">Family Code</label>
              <input name="familyCode" type="password" required className="input-field" placeholder="••••••••" />
            </div>
          )}

          <div>
            <label className="label">Your Name</label>
            <input name="displayName" type="text" required className="input-field" placeholder="Display name" autoComplete="username" />
          </div>

          <div>
            <label className="label">4-Digit PIN</label>
            <input
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              required
              className="input-field text-center tracking-[0.5em] text-xl font-bold"
              placeholder="••••"
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </div>

          {isRegister && (
            <div>
              <label className="label">Favorite Team (optional)</label>
              <select name="favoriteTeamCode" className="input-field">
                <option value="">— Pick a team —</option>
                {GROUP_LETTERS.map((letter) => {
                  const groupTeams = teams.filter((t) => t.group_letter === letter);
                  if (!groupTeams.length) return null;
                  return (
                    <optgroup key={letter} label={`Group ${letter}`}>
                      {groupTeams.map((t) => (
                        <option key={t.fifa_code} value={t.fifa_code}>
                          {t.fifa_code} — {t.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
          )}

          <div>
            <label className="label">Admin Code (optional)</label>
            <input name="adminInviteCode" type="password" className="input-field" placeholder="Admin invite code" />
          </div>

          {error && <div className="alert-error">{error}</div>}

          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "…" : isRegister ? "Join the Pool 🎉" : "Enter ⚽"}
          </button>
        </form>
      </div>
    </div>
  );
}
