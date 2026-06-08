"use client";

interface ScoreControlProps {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function ScoreControl({
  value,
  onChange,
  disabled,
  compact = false,
}: ScoreControlProps) {
  if (compact) {
    return (
      <div
        className={`score-stepper score-stepper--compact ${
          disabled ? "score-stepper-locked" : ""
        }`}
      >
        <button
          type="button"
          disabled={disabled || value === null || value <= 0}
          onClick={() => onChange(value === null ? null : Math.max(0, value - 1))}
          className="score-stepper-btn"
          aria-label="Decrease score"
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value === null ? "" : value}
          disabled={disabled}
          readOnly={disabled}
          placeholder="–"
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === "") {
              onChange(null);
              return;
            }
            const n = Number(raw);
            if (Number.isFinite(n)) {
              onChange(Math.min(20, Math.max(0, n)));
            }
          }}
          className="score-stepper-input disabled:opacity-50 placeholder:text-ink-faint placeholder:font-bold"
          aria-label="Score"
        />
        <button
          type="button"
          disabled={disabled || value !== null && value >= 20}
          onClick={() => onChange(value === null ? 0 : value + 1)}
          className="score-stepper-btn"
          aria-label="Increase score"
        >
          +
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        disabled={disabled || (value !== null && value >= 20)}
        onClick={() => onChange(value === null ? 0 : value + 1)}
        className="score-btn"
        aria-label="Increase score"
      >
        +
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value === null ? "" : value}
        disabled={disabled}
        placeholder="–"
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (raw === "") {
            onChange(null);
            return;
          }
          const n = Number(raw);
          if (Number.isFinite(n)) {
            onChange(Math.min(20, Math.max(0, n)));
          }
        }}
        className="score-input disabled:opacity-50"
        aria-label="Score"
      />
      <button
        type="button"
        disabled={disabled || value === null || value <= 0}
        onClick={() => onChange(value === null ? null : Math.max(0, value - 1))}
        className="score-btn"
        aria-label="Decrease score"
      >
        −
      </button>
    </div>
  );
}

interface ScorePickerProps {
  homeScore: number | null;
  awayScore: number | null;
  onHomeChange: (v: number | null) => void;
  onAwayChange: (v: number | null) => void;
  disabled?: boolean;
}

export function ScorePicker({
  homeScore,
  awayScore,
  onHomeChange,
  onAwayChange,
  disabled,
}: ScorePickerProps) {
  return (
    <div className="score-zone">
      <div className="flex items-center justify-center gap-4">
        <ScoreControl value={homeScore} onChange={onHomeChange} disabled={disabled} />
        <div className="flex flex-col items-center gap-0.5 px-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">
            vs
          </span>
          <span className="text-2xl font-black text-ink/20">:</span>
        </div>
        <ScoreControl value={awayScore} onChange={onAwayChange} disabled={disabled} />
      </div>
    </div>
  );
}

export function ScoreDisplay({
  value,
  compact = false,
}: {
  value: number | null;
  compact?: boolean;
}) {
  return (
    <div
      className={`score-stepper score-stepper-readonly ${
        compact ? "score-stepper--compact" : ""
      }`}
    >
      <span className="score-stepper-value tabular-nums">
        {value === null ? "–" : value}
      </span>
    </div>
  );
}
