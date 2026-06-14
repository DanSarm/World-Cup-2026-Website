import type { PlayerAchievement } from "@/lib/playerProfile";
import { PlaceMedal } from "./PlaceMedal";
import { WORLD_CUP_TROPHY_PATH } from "@/lib/site";

const TIER_CLASS: Record<PlayerAchievement["tier"], string> = {
  legendary: "achievement-badge--legendary",
  gold: "achievement-badge--gold",
  silver: "achievement-badge--silver",
  bronze: "achievement-badge--bronze",
};

function BadgeIcon({ achievement }: { achievement: PlayerAchievement }) {
  if (achievement.icon === "trophy") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={WORLD_CUP_TROPHY_PATH}
        alt=""
        aria-hidden
        className="achievement-badge-trophy"
      />
    );
  }

  if (achievement.icon === "medal-2") {
    return <PlaceMedal tier="second" className="achievement-badge-medal" />;
  }

  if (achievement.icon === "medal-3") {
    return <PlaceMedal tier="third" className="achievement-badge-medal" />;
  }

  const glyph: Record<
    Exclude<PlayerAchievement["icon"], "trophy" | "medal-2" | "medal-3">,
    string
  > = {
    target: "◎",
    flame: "✦",
    rocket: "↑",
    chart: "↗",
    dice: "?",
    star: "★",
    cash: "$",
    shield: "◆",
  };

  return (
    <span className="achievement-badge-glyph" aria-hidden>
      {glyph[achievement.icon]}
    </span>
  );
}

function AchievementBadge({ achievement }: { achievement: PlayerAchievement }) {
  return (
    <article
      className={`achievement-badge ${TIER_CLASS[achievement.tier]}`}
      title={[achievement.title, achievement.stat, achievement.subtitle]
        .filter(Boolean)
        .join(" · ")}
    >
      <div className="achievement-badge-ring">
        <div className="achievement-badge-core">
          <BadgeIcon achievement={achievement} />
        </div>
      </div>
      <div className="achievement-badge-copy">
        <p className="achievement-badge-title">{achievement.title}</p>
        {achievement.stat && (
          <p className="achievement-badge-stat">{achievement.stat}</p>
        )}
        {achievement.subtitle && (
          <p className="achievement-badge-subtitle">{achievement.subtitle}</p>
        )}
      </div>
    </article>
  );
}

export function AchievementShowcase({
  achievements,
}: {
  achievements: PlayerAchievement[];
}) {
  if (achievements.length === 0) return null;

  return (
    <section className="card achievement-showcase p-4 sm:p-5">
      <div className="achievement-showcase-header">
        <h2 className="achievement-showcase-title">Trophy case</h2>
        <span className="achievement-showcase-count">
          {achievements.length} earned
        </span>
      </div>
      <div className="achievement-showcase-grid">
        {achievements.map((achievement) => (
          <AchievementBadge key={achievement.id} achievement={achievement} />
        ))}
      </div>
    </section>
  );
}
