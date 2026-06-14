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
| `ODDS_REGIONS` | Comma-separated regions — use `us` only on free tier (1 credit per call) |
| `ODDS_WINNER_REGIONS` | Regions for champion odds (default: `us`) |
| `LIVE_SCORES_MAX_SYNCS_PER_DAY` | Cap on scores API calls per day (default: 8) |
| `LIVE_SCORES_MIN_INTERVAL_MS` | Min ms between score syncs (default: 600000 = 10 min) |
| `CRON_SECRET` | Protects optional cron routes (not required for live scores) |
| `VAPID_PUBLIC_KEY` | Web Push public key (see pick reminders below) |
| `VAPID_PRIVATE_KEY` | Web Push private key (server only) |
| `VAPID_SUBJECT` | Contact for push service, e.g. `mailto:you@example.com` |

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

Optional: set `CRON_SECRET` and schedule `POST /api/cron/sync-odds` manually before match days (do **not** run every minute — each call costs credits).

#### Free tier API budget (500 credits/month)

The app is configured to stay within The Odds API **free tier** for the full World Cup:

| Usage | Cost | When |
|---|---|---|
| Match odds sync (admin) | 1 credit per call with `ODDS_REGIONS=us` | Manual, before match days |
| Live scores | 1 credit per sync | Only during in-play windows, max 8/day, 10 min apart |
| Final scores | +1 extra credit once/day | First sync of the day picks up completed games |
| Champion odds panel | 1 credit per day max | Cached 24 hours |

Live scores **do not** run on a Vercel cron. Pages poll only while a match may be live; the server enforces throttling and a daily cap. If the API reports low remaining credits, syncs stop automatically.

**Tips:** Keep `ODDS_REGIONS=us`. Sync match odds from admin once per match day, not repeatedly. Enter final scores manually in admin if you ever hit the daily cap.

### 7. Deploy to Vercel

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Set **Framework Preset** to **Next.js** (or rely on repo `vercel.json`)
4. Leave **Output Directory** empty (do not set `.next` manually)
5. Add all env vars from `.env.local` in Vercel project settings
6. Deploy with **Discard build cache** if a prior deploy showed middleware or 404 errors

### 8. Notifications (free, no cron service)

Push notifications use **Web Push** (free) — no Firebase, OneSignal, or paid cron.

**What you get automatically:**

| Alert | When it fires |
|---|---|
| Pick reminder | ~15 min before kickoff if you have no pick |
| Exact score | Your pick matched the final score |
| Correct result | Right winner/draw, not exact |
| Fire bonus | Exact-score fire bonus earned |
| Big points | 15+ pts on one match |
| Rank up | You moved up after a result |
| Top 3 | You entered the top 3 |
| Live exact | Live score currently matches your pick |

**Setup:**

1. Run both SQL migrations in Supabase:
   ```
   supabase/migrations/add_push_notifications.sql
   supabase/migrations/add_notifications_sent.sql
   ```
   Or: `npm run migrate:push-notifications`

2. Generate VAPID keys:
   ```bash
   npx web-push generate-vapid-keys
   ```
   Add to `.env.local` and Vercel: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:you@example.com`

3. Deploy — **no external cron needed.** Score alerts fire when ESPN syncs or admin saves a result. Pick reminders use your phone/browser timers when you visit the app, plus background push when anyone has the site open.

4. Tap **Enable notifications** in the app banner.

**iPhone:** Add the site to Home Screen first (iOS 16.4+), then enable notifications.

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
- **Tournament Picks** — Champion, Runner-up & Third Place with market-based dynamic points (favorites small, longshots huge)
- **Leaderboard** — Points, exact scores, projected prizes
- **Admin** — Players, matches, scores, settings (admin only)

## Scoring

- Group match: up to **18 pts** (3 result + outcome bonus + 5 exact + fire bonus)
- Knockout match: stage points + exact score + advance bonus for underdog picks
- Perfect day bonus: **+5 pts** (2+ matches, all correct)
- Before Cup + Finals Challenge have separate point tables

Outcome bonuses are derived from implied probabilities (admin can sync via The Odds API or set manually).

## Tech

Next.js 15 · TypeScript · Tailwind CSS · Supabase Postgres · bcryptjs · jose · zod
