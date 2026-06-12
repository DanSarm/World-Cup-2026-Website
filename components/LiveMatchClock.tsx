export function LiveMatchClock({
  clock,
  className = "",
}: {
  clock?: string | null;
  className?: string;
}) {
  if (!clock) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full bg-canada/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-canada tabular-nums ${className}`}
    >
      {clock}
    </span>
  );
}
