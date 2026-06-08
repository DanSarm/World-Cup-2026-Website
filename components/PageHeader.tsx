import { Flag } from "./Flag";
import { SiteLogo } from "./SiteLogo";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  emoji?: string;
  flags?: string[];
  logo?: boolean;
  badge?: string;
}

export function PageHeader({ title, subtitle, emoji, flags, logo, badge }: PageHeaderProps) {
  return (
    <header className="space-y-1 mb-6">
      <div className="flex items-start gap-3">
        {logo ? (
          <SiteLogo size="md" className="shrink-0 mt-0.5" />
        ) : flags && flags.length > 0 ? (
          <div className="flex gap-1 mt-1 shrink-0" aria-hidden>
            {flags.map((code) => (
              <Flag key={code} fifaCode={code} size="sm" />
            ))}
          </div>
        ) : emoji ? (
          <span className="text-3xl leading-none mt-0.5" aria-hidden>
            {emoji}
          </span>
        ) : null}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gold-gradient">
            {title}
          </h1>
          {subtitle && (
            <p className="text-on-dark-muted text-sm mt-1.5 leading-relaxed">{subtitle}</p>
          )}
        </div>
        {badge && <span className="badge badge-soon shrink-0">{badge}</span>}
      </div>
    </header>
  );
}
