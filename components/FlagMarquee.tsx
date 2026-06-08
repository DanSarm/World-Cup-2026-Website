import { allFifaCodes } from "@/lib/flags";
import { Flag } from "./Flag";

export function FlagMarquee() {
  const codes = allFifaCodes();
  const track = [...codes, ...codes];

  return (
    <div className="flag-marquee" aria-hidden>
      <div className="flag-marquee-track">
        {track.map((code, i) => (
          <Flag key={`${code}-${i}`} fifaCode={code} size="sm" className="shrink-0" />
        ))}
      </div>
    </div>
  );
}
