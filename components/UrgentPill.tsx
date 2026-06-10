/** Highlights actions new players should complete before kickoff. */
export function UrgentPill({ className = "" }: { className?: string }) {
  return (
    <span className={`urgent-pill${className ? ` ${className}` : ""}`}>
      Urgent
    </span>
  );
}
