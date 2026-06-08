interface TeamCodeProps {
  code: string;
  className?: string;
  prominent?: boolean;
}

/** Three-letter FIFA code — uses Saira Condensed. */
export function TeamCode({ code, className = "", prominent = false }: TeamCodeProps) {
  return (
    <span
      className={`font-team-code font-bold uppercase ${
        prominent
          ? "text-xl sm:text-2xl tracking-wide leading-none"
          : "text-[10px] tracking-widest"
      } ${className}`}
    >
      {code}
    </span>
  );
}
