interface ScoreBreakdownListProps {
  lines: string[];
  className?: string;
}

export function ScoreBreakdownList({
  lines,
  className = "",
}: ScoreBreakdownListProps) {
  if (!lines.length) return null;

  return (
    <ul className={`text-sm space-y-0.5 ${className}`}>
      {lines.map((line) => (
        <li
          key={line}
          className={
            line.startsWith("Total:")
              ? "font-bold text-mexico pt-1"
              : "text-ink-muted"
          }
        >
          {line}
        </li>
      ))}
    </ul>
  );
}
