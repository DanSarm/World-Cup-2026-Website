import type { PickFormSlot } from "@/lib/types";

interface RecentPickFormDotsProps {
  form: PickFormSlot[];
  className?: string;
}

const SLOT_LABELS: Record<NonNullable<PickFormSlot>, string> = {
  exact: "Exact score",
  correct: "Correct winner",
  wrong: "Wrong winner",
  "live-exact": "Exact score right now",
  "live-correct": "Winning pick so far",
  "live-wrong": "Can't win anymore",
  "live-pending": "Still in play",
};

function slotShellClass(result: PickFormSlot): string {
  if (result === "exact" || result === "live-exact") {
    return "bg-gold/30 ring-1 ring-gold/50";
  }
  if (result === "correct" || result === "live-correct") {
    return "bg-mexico/20 ring-1 ring-mexico/40";
  }
  if (result === "wrong" || result === "live-wrong") {
    return "bg-canada/20 ring-1 ring-canada/35";
  }
  if (result === "live-pending") return "bg-ink/12 ring-1 ring-ink/10";
  return "bg-ink/10";
}

function SlotIcon({ result }: { result: PickFormSlot }) {
  if (!result) return null;

  if (result === "exact" || result === "live-exact") {
    return (
      <span className="text-[9px] leading-none" aria-hidden>
        🏆
      </span>
    );
  }

  if (result === "correct" || result === "live-correct") {
    return (
      <svg
        viewBox="0 0 12 12"
        className="w-2.5 h-2.5 text-mexico"
        aria-hidden
      >
        <path
          fill="currentColor"
          d="M4.75 8.35 2.4 6a.75.75 0 1 1 1.06-1.06l1.29 1.29 3.2-3.2a.75.75 0 1 1 1.06 1.06l-3.73 3.86Z"
        />
      </svg>
    );
  }

  if (result === "wrong" || result === "live-wrong") {
    return (
      <svg
        viewBox="0 0 12 12"
        className="w-2.5 h-2.5"
        aria-hidden
      >
        <circle cx="6" cy="6" r="5.25" fill="#fff" stroke="var(--color-canada)" strokeWidth="1.25" />
        <path
          fill="var(--color-canada)"
          d="M4.1 4.1a.55.55 0 0 1 .78 0L6 5.22l1.12-1.12a.55.55 0 1 1 .78.78L6.78 6l1.12 1.12a.55.55 0 1 1-.78.78L6 6.78 4.88 7.9a.55.55 0 1 1-.78-.78L5.22 6 4.1 4.88a.55.55 0 0 1 0-.78Z"
        />
      </svg>
    );
  }

  return (
    <span
      className="w-1.5 h-1.5 rounded-full bg-ink/35 animate-pulse"
      aria-hidden
    />
  );
}

export function RecentPickFormDots({
  form,
  className = "",
}: RecentPickFormDotsProps) {
  const slots: PickFormSlot[] =
    form.length === 5
      ? form
      : ([...Array(5 - form.length).fill(null), ...form] as PickFormSlot[]);

  return (
    <span
      className={`inline-flex items-center gap-1 shrink-0 ${className}`}
      title="Last 5 results (right = most recent)"
    >
      {slots.map((result, index) => (
        <span
          key={index}
          className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${slotShellClass(result)}`}
          title={result != null ? SLOT_LABELS[result] : "No result yet"}
        >
          <SlotIcon result={result} />
        </span>
      ))}
    </span>
  );
}
