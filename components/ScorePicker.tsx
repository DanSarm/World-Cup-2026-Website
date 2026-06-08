"use client";

interface ScoreControlProps {
  value: number;
  onChange: (v: number) => void;
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
      <div className="score-stepper">
        <button
          type="button"
          disabled={disabled || value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="score-stepper-btn"
          aria-label="Decrease score"
        >
          −
        </button>
        <input
          type="number"
          min={0}
          max={20}
          value={value}
          disabled={disabled}
          onChange={(e) =>
            onChange(Math.min(20, Math.max(0, Number(e.target.value) || 0)))
          }
          className="score-stepper-input disabled:opacity-50"
          aria-label="Score"
        />
        <button
          type="button"
          disabled={disabled || value >= 20}
          onClick={() => onChange(value + 1)}
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
        disabled={disabled || value >= 20}
        onClick={() => onChange(value + 1)}
        className="score-btn"
        aria-label="Increase score"
      >
        +
      </button>
      <input
        type="number"
        min={0}
        max={20}
        value={value}
        disabled={disabled}
        onChange={(e) =>
          onChange(Math.min(20, Math.max(0, Number(e.target.value) || 0)))
        }
        className="score-input disabled:opacity-50"
        aria-label="Score"
      />
      <button
        type="button"
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="score-btn"
        aria-label="Decrease score"
      >
        −
      </button>
    </div>
  );
}

interface ScorePickerProps {
  homeScore: number;
  awayScore: number;
  onHomeChange: (v: number) => void;
  onAwayChange: (v: number) => void;
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

export function ScoreDisplay({ value }: { value: number }) {
  return (
    <div className="score-stepper score-stepper-readonly">
      <span className="score-stepper-value tabular-nums">{value}</span>
    </div>
  );
}
