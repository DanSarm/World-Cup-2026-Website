import Link from "next/link";

export function AllPicksDoneHero() {
  return (
    <section className="card text-center space-y-4 py-10 px-6">
      <div className="text-5xl">🎉</div>
      <h2 className="text-2xl font-extrabold text-usa">All picks saved</h2>
      <p className="text-sm text-ink-muted">
        You&apos;re caught up on every open match. Check back when new games unlock.
      </p>
      <Link href="/picks" className="btn-gold inline-block">
        View your picks
      </Link>
    </section>
  );
}
