export function NavPageSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div
      className={`mx-auto w-full animate-pulse space-y-4 ${
        wide ? "max-w-5xl" : "max-w-lg md:max-w-2xl"
      }`}
      aria-hidden
    >
      <div className="h-8 w-40 rounded-lg bg-white/10" />
      <div className="h-4 w-56 rounded bg-white/5" />
      <div className="card space-y-3 !bg-white/[0.04]">
        <div className="h-5 w-3/4 rounded bg-white/10" />
        <div className="h-24 rounded-xl bg-white/[0.06]" />
        <div className="h-24 rounded-xl bg-white/[0.06]" />
      </div>
      <div className="card space-y-3 !bg-white/[0.04]">
        <div className="h-5 w-1/2 rounded bg-white/10" />
        <div className="h-16 rounded-xl bg-white/[0.06]" />
      </div>
    </div>
  );
}
