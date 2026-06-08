import { formatMoney } from "@/lib/payouts";

interface PrizeCardProps {
  icon: string;
  label: string;
  value: string | number;
  sublabel?: string;
  highlight?: boolean;
}

export function PrizeCard({
  icon,
  label,
  value,
  sublabel,
  highlight,
}: PrizeCardProps) {
  return (
    <div className={highlight ? "card-highlight text-center space-y-2" : "card text-center space-y-2"}>
      <div className="text-2xl">{icon}</div>
      <div className="text-[10px] text-ink-muted font-bold uppercase tracking-widest">
        {label}
      </div>
      <div className="text-2xl font-extrabold text-usa tracking-tight">
        {typeof value === "number" ? formatMoney(value) : value}
      </div>
      {sublabel && <div className="text-xs text-ink-faint">{sublabel}</div>}
    </div>
  );
}

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
}

export function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="card p-4 text-center space-y-1.5">
      <div className="text-xl">{icon}</div>
      <div className="text-[10px] text-ink-muted font-semibold uppercase tracking-wide">
        {label}
      </div>
      <div className="text-sm font-bold text-usa leading-snug">{value}</div>
    </div>
  );
}
