# Family Cup 2026

A private friends-and-family World Cup 2026 prediction pool. Pick scores, earn points, win prizes — no betting, no payments in-app.

## Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Run the database schema

Open the Supabase SQL Editor and run the contents of:

```
supabase/schema.sql
```

### 3. Configure environment variables

Copy the example env file:

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SITE_NAME` | Display name (default: Family Cup 2026) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (browser-safe) |
| `SUPABASE_URL` | Same URL as above (server; optional if public URL is set) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server only — never expose to browser) |
| `SESSION_SECRET` | Random string, at least 16 characters |
| `FAMILY_ACCESS_CODE` | Code new players enter to join |
| `ADMIN_INVITE_CODE` | Code that grants admin access |
| `ODDS_API_KEY` | The Odds API key (optional; for auto bonus points) |
| `ODDS_REGIONS` | Comma-separated regions, e.g. `us,uk,eu` |
| `ODDS_LOCK_HOURS_BEFORE_KICKOFF` | Hours before kickoff to lock bonuses (default: 1) |
| `CRON_SECRET` | Protects `/api/cron/sync-odds` when using Vercel cron |

### 4. Seed match fixtures

After running the schema (teams are seeded automatically), seed matches:

```bash
npm run seed
```

Kickoff times are placeholders. Use the admin CSV import to set exact times.

### 5. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Outcome bonus points from odds (optional)

This app is **not** a gambling app — odds are used only to calculate simple bonus points for harder picks. Users never see sportsbook odds.

1. Create a free account at [The Odds API](https://the-odds-api.com/).
2. Add `ODDS_API_KEY` to `.env.local` (see `.env.example` for all odds-related vars).
3. Run the odds migration in Supabase SQL Editor:
   ```
   supabase/migrations/add_odds_snapshots.sql
   ```
4. In **Admin → Matches**, click **Sync odds for all upcoming matches**, or open a match’s **Odds & Bonuses** panel to sync one fixture.
5. Users will see simple bonus pills like “Draw +3” or “Uzbekistan +5” — not decimal or American odds.

Optional: set `CRON_SECRET` and schedule `POST /api/cron/sync-odds` (e.g. every 6 hours pre-tournament, hourly on match days).

### 7. Deploy to Vercel

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Set **Framework Preset** to **Next.js** (or rely on repo `vercel.json`)
4. Leave **Output Directory** empty (do not set `.next` manually)
5. Add all env vars from `.env.local` in Vercel project settings
6. Deploy with **Discard build cache** if a prior deploy showed middleware or 404 errors

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run test` | Run scoring unit tests |
| `npm run seed` | Seed match fixtures to Supabase |

## Pages

- **Home** — Prize pot, your stats, next matches, top 5
- **Picks** — Score predictions for every match
- **Big Picks** — Before Cup + Finals Challenge
- **Leaderboard** — Points, exact scores, projected prizes
- **Admin** — Players, matches, scores, settings (admin only)

## Scoring

- Group match: up to **7+ bonus pts** (3 result + 3 exact + 1 margin + outcome bonus for underdog/draw picks)
- Knockout match: stage points + exact score + advance bonus for underdog picks
- Perfect day bonus: **+5 pts** (2+ matches, all correct)
- Before Cup + Finals Challenge have separate point tables

Outcome bonuses are derived from implied probabilities (admin can sync via The Odds API or set manually).

## Tech

Next.js 15 · TypeScript · Tailwind CSS · Supabase Postgres · bcryptjs · jose · zod
