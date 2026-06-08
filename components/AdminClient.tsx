"use client";

import { useState } from "react";
import { AdminPlayers } from "@/components/AdminPlayers";
import { AdminMatches } from "@/components/AdminMatches";
import { AdminSettings } from "@/components/AdminSettings";
import { PageHeader } from "@/components/PageHeader";
import type { Match, Player, Settings } from "@/lib/types";

interface AdminClientProps {
  players: Player[];
  matches: Match[];
  teams: import("@/lib/types").Team[];
  settings: Settings;
  auditLog: Array<{
    id: string;
    action: string;
    created_at: string;
    actor_player_id: string | null;
  }>;
  oddsApiConfigured?: boolean;
  oddsSchemaOk?: boolean;
  oddsSchemaError?: string;
}

type Section = "players" | "matches" | "scores" | "settings";

export function AdminClient({
  players,
  matches,
  teams,
  settings,
  auditLog,
  oddsApiConfigured = false,
  oddsSchemaOk = true,
  oddsSchemaError,
}: AdminClientProps) {
  const [section, setSection] = useState<Section>("players");

  const sections: { key: Section; label: string }[] = [
    { key: "players", label: "Players" },
    { key: "matches", label: "Matches" },
    { key: "scores", label: "Scores" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader emoji="⚙️" title="Admin" subtitle="Manage pool settings & data" />

      <div className="segmented">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            type="button"
            className={`segment text-xs ${section === s.key ? "segment-active" : ""}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "players" && <AdminPlayers players={players} />}

      {(section === "matches" || section === "scores") && (
        <AdminMatches
          matches={matches}
          teams={teams}
          oddsApiConfigured={oddsApiConfigured}
          oddsSchemaOk={oddsSchemaOk}
          oddsSchemaError={oddsSchemaError}
        />
      )}

      {section === "settings" && (
        <>
          <AdminSettings settings={settings} players={players} />
          <div className="card space-y-2">
            <h3 className="font-bold text-pitch-900 text-sm">Audit Log</h3>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {auditLog.slice(0, 20).map((log) => (
                <div key={log.id} className="text-xs text-ink-faint border-b border-ink/5 py-1.5">
                  {new Date(log.created_at).toLocaleString()} — {log.action}
                </div>
              ))}
              {auditLog.length === 0 && (
                <p className="text-xs text-ink-faint">No entries yet</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
