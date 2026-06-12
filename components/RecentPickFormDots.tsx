import type { PickFormSlot } from "@/lib/types";
import {
  padPickFormSlots,
  RECENT_FORM_DESKTOP_COUNT,
  RECENT_FORM_MOBILE_COUNT,
} from "@/lib/recentPickForm";

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
    return "bg-gold-light ring-2 ring-gold-dark shadow-[0_1px_6px_rgb(212_175_55/0.55)]";
  }
  if (result === "correct" || result === "live-correct") {
    return "bg-mexico-light ring-2 ring-mexico shadow-[0_1px_6px_rgb(0_104_71/0.5)]";
  }
  if (result === "wrong" || result === "live-wrong") {
    return "bg-canada ring-2 ring-canada-light shadow-[0_1px_6px_rgb(200_16_46/0.55)]";
  }
  if (result === "live-pending") {
    return "bg-ink/25 ring-2 ring-ink/30";
  }
  return "bg-ink/15 ring-1 ring-ink/25";
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
        className="w-2.5 h-2.5 text-white"
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
        <path
          fill="#fff"
          d="M4.1 4.1a.55.55 0 0 1 .78 0L6 5.22l1.12-1.12a.55.55 0 1 1 .78.78L6.78 6l1.12 1.12a.55.55 0 1 1-.78.78L6 6.78 4.88 7.9a.55.55 0 1 1-.78-.78L5.22 6 4.1 4.88a.55.55 0 0 1 0-.78Z"
        />
      </svg>
    );
  }

  return (
    <span
      className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse"
      aria-hidden
    />
  );
}

export function RecentPickFormDots({
  form,
  className = "",
}: RecentPickFormDotsProps) {
  const slots = padPickFormSlots(form, RECENT_FORM_DESKTOP_COUNT);
  const mobileHiddenCount =
    RECENT_FORM_DESKTOP_COUNT - RECENT_FORM_MOBILE_COUNT;

  return (
    <span
      className={`inline-flex items-center gap-1 shrink-0 ${className}`}
      title="Recent results (right = most recent)"
    >
      {slots.map((result, index) => (
        <span
          key={index}
          className={`w-4 h-4 rounded-full items-center justify-center shrink-0 ${slotShellClass(result)} ${
            index < mobileHiddenCount ? "hidden sm:flex" : "flex"
          }`}
          title={result != null ? SLOT_LABELS[result] : "No result yet"}
        >
          <SlotIcon result={result} />
        </span>
      ))}
    </span>
  );
}
