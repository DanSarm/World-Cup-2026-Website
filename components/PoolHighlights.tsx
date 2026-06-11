import type { HighlightCard, PoolHighlights } from "@/lib/poolHighlights";

function HighlightCardView({ card }: { card: HighlightCard }) {
  return (
    <article className="pool-highlight-card card p-4 space-y-2">
      <p className="text-sm font-bold text-ink">
        <span className="mr-1.5" aria-hidden>
          {card.icon}
        </span>
        {card.title}
      </p>
      <p className="text-sm font-semibold text-usa leading-snug">{card.headline}</p>
      {Array.isArray(card.detail) ? (
        <div className="space-y-1">
          {card.detail.map((line, index) => (
            <p key={index} className="text-xs text-ink-muted leading-snug">
              {line}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-xs text-ink-muted">{card.detail}</p>
      )}
    </article>
  );
}

interface PoolHighlightsSectionProps {
  highlights: PoolHighlights;
}

export function PoolHighlightsSection({
  highlights,
}: PoolHighlightsSectionProps) {
  const cards = [
    highlights.currentLeader,
    highlights.exactKing,
    highlights.miracleMaker,
    highlights.biggestClimber,
    highlights.bestPick,
    highlights.perfectDayClub,
    highlights.chaosPick,
  ].filter((card): card is HighlightCard => card != null);

  return (
    <section className="space-y-3">
      <h2 className="section-title px-0.5">Pool Highlights</h2>
      <div className="flex flex-col gap-3">
        {cards.map((card) => (
          <HighlightCardView key={card.title} card={card} />
        ))}
      </div>
    </section>
  );
}
