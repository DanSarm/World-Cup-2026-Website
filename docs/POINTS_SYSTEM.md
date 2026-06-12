# Family Cup 2026 — Complete Points System

This document describes **every scoring rule** implemented in the Family Cup 2026 pool website, as of the current codebase. Use it to explain or audit how points are awarded.

---

## Overview: What counts toward the leaderboard?

Each player’s **total points** = sum of:

| Category | Description |
|----------|-------------|
| **Match pick points** | Points from individual game score predictions (group + knockout) |
| **Tournament Picks (podium)** | Champion / runner-up / 3rd place (market-based, scored at end of tournament) |
| **Manual adjustments** | Admin-added/subtracted points (if any) |

**Perfect Day** is tracked as a fun highlight/badge only — it awards **0 points** toward the leaderboard.

**Not included in main leaderboard total:** “Finals Challenge” is tracked separately (legacy side game).

During a **live** match, the site may show **provisional** totals that include points you would earn if the game ended at the current score. Those points are only finalized when the match status becomes `final`.

---

## Match picks — core rules

### When is a pick scored?

- A pick must be **confirmed/saved** before kickoff.
- **No saved pick = 0 points.** Missing picks are **not** auto-scored as 0–0.
- Group/knockout picks are scored when `status = final`.
- Live/provisional scoring uses the current score while `status = locked` (in progress).

### Wrong result = zero

For **group stage** matches, if your predicted **outcome** (home win / away win / draw) does not match the actual outcome, you get **0 points**.

For **knockout** matches, you must pick the **correct advancing team**. Wrong team = **0 points total** — no exact score credit.

**Core principle:** Only an **exact score** earns extra scoreline points (+5 exact + optional fire). Correct result with the wrong score earns base + outcome bonus only. There are no one-goal-off, two-goals-off, or goal-difference margin bonuses.

---

## Group stage match scoring (step by step)

Applies when `match.stage = "group"`.

### Step 1 — Correct result? (required)

Compare outcomes:

- **Home win:** predicted home goals > away goals  
- **Away win:** predicted away goals > home goals  
- **Draw:** predicted home goals = away goals  

If outcome ≠ actual outcome → **0 points total**. Stop.

### Step 2 — Base points (correct outcome only)

```
base = 3 + outcome_bonus
```

**Outcome bonus** depends on which result actually happened. Each match stores three bonus values (from pre-match odds):

| Field | When it applies |
|-------|-----------------|
| `home_win_bonus` | Actual result is home win |
| `draw_bonus` | Actual result is draw |
| `away_win_bonus` | Actual result is away win |

These bonuses reward picking **unlikely** outcomes that come true. They are **not** added for picking that outcome — they are added when that outcome **actually happens** and you predicted the correct result type.

#### How outcome bonuses are set (from The Odds API)

Implied win probability (no-vig) → bonus points:

| Implied probability | Bonus |
|---------------------|-------|
| ≥ 35% | 0 |
| ≥ 25% | 0 |
| ≥ 20% | +1 |
| ≥ 10% | +4 |
| ≥ 5%  | +6 |
| < 5%  | +8 |

**Competitive no-bonus rule (group stage, step 1):** If the favorite is under **50%** and **home, draw, and away are each at least 25%**, every outcome bonus is **0**. Examples: Korea 37/30/33 → all +0; Netherlands 47/27/26 → all +0.

If any outcome is below 25%, the competitive rule does **not** apply and step 2 table runs per outcome. Example: USA 48/28/24 → USA +0, Draw +0, Paraguay +1. Switzerland 78/15/7 → Switzerland +0, Draw +4, Qatar +6.

Admin can also set bonuses manually per match (manual entries without implied probabilities use stored bonus values as-is).

**Labels shown in UI:** Sneaky +1, Shock +4, Miracle +6, Impossible +8

### Step 3 — Exact score bonus (exact only)

Only when your predicted score **exactly** matches the actual score:

```
+5 exact score bonus
+ fire bonus (optional, see Step 4)
```

If the result is correct but the score is wrong, you get **no** extra scoreline points — only the Step 2 base (3 + outcome bonus).

**Examples (actual Mexico 2–0, home win bonus = 0):**

| Pick | Outcome correct? | Points |
|------|------------------|--------|
| 2–0 | ✓ exact | 3 + 5 = **8** |
| 3–0, 2–1, 1–0 | ✓ | **3** |
| 3–1, 4–2 | ✓ | **3** |
| 1–1, 0–1 | ✗ | **0** |
| No pick | — | **0** |

### Step 4 — Exact Score Fire Bonus (optional, exact only)

Only when you hit the **exact score**. Extra points for “crazy” or unlikely exact scorelines. **Off** if admin disables `exact_score_fire_bonus_enabled`.

#### Non-draw exact scores

Uses `outcome_bonus` (from step 2) and `winning_margin` = |home − away|:

**If outcome_bonus ≥ 6 (miracle tier):**

| Winning margin | Fire bonus |
|----------------|------------|
| 1 | +2 |
| 2 | +3 |
| ≥ 3 | +4 |

**If outcome_bonus ≥ 4:**

| Winning margin | Fire bonus |
|----------------|------------|
| 1 | +1 |
| 2 | +2 |
| ≥ 3 | +3 |

**If outcome_bonus ≥ 2:**

| Winning margin | Fire bonus |
|----------------|------------|
| 1 | 0 |
| 2 | +1 |
| ≥ 3 | +2 |

**If outcome_bonus = 0 or 1 (favorite wins):**

| Winning margin | Fire bonus |
|----------------|------------|
| 1–2 | 0 |
| 3–4 | +1 |
| ≥ 5 | +2 |

#### Draw exact scores

- +1 if total goals ≥ 4  
- +2 if total goals ≥ 6  
- +1 extra if outcome_bonus ≥ 6 **and** total goals ≥ 2  
- **Cap:** fire bonus on draws max **4**

### Step 5 — Group stage cap

```
total = min(calculated_points, group_stage_match_point_cap)
```

**Default cap: 18 points per group match.**

Configurable via admin setting `group_stage_match_point_cap` (legacy key: `max_group_match_points`).

---

## Worked example: Mexico 2–0 South Africa (Match #1)

Typical synced odds for this opener (approximate):

- Mexico (home) implied win ≈ **67%** → `home_win_bonus = **0**` (favorite, ≥50%)  
- Draw ≈ 22% → `draw_bonus = 2`  
- South Africa ≈ 11% → `away_win_bonus = 4`  

**Final: Mexico 2–0 South Africa**

| Pick | Breakdown | Total |
|------|-----------|-------|
| **2–0** | 3 base + 0 home bonus + 5 exact + 0 fire | **8** |
| **3–0, 2–1, 1–0, 3–1, 4–2** | 3 base + 0 home bonus | **3** |
| **1–1** | Wrong outcome (draw vs home win) | **0** |
| **0–1** | Wrong outcome (away win) | **0** |
| **No pick** | Not submitted | **0** |

If Mexico’s home win bonus were **+1** (e.g. ~40% implied), exact 2–0 would be **9**, and 3–0 would still be **4** (3 + 1).

**Exact 2–0 fire bonus = 0** because Mexico is the favorite (outcome_bonus 0) and winning margin is only 2.

---

## Knockout stage match scoring

Applies to: `round_of_32`, `round_of_16`, `quarterfinal`, `semifinal`, `third_place`, `final`.

### Correct advancing team

```
base = round_points + advance_bonus
```

**Round base points:**

| Stage | Points |
|-------|--------|
| Round of 32 | 4 |
| Round of 16 | 5 |
| Quarterfinal | 6 |
| Semifinal | 8 |
| Third place | 5 |
| Final | 10 |

**Advance bonus:** same tier table as group outcome bonuses, but uses `home_advance_bonus` / `away_advance_bonus` on the match (from knockout advance markets or manual).

You must pick the **correct winner** (`pred_winner_team_id` matches the team that advances). For score picks, the winner is inferred from your predicted scores unless you explicitly set a winner on a draw scoreline.

### Exact score (knockout)

If exact score **and** correct advancing team:

```
+5 exact score bonus
+ fire bonus (same fire rules as group, using advance_bonus as outcome_bonus)
```

If correct advancing team but not exact, you receive **round base + advance bonus only** — no extra scoreline points.

Penalty shootout goals do **not** count toward the exact score. If a knockout match ends tied after extra time, the stored score is the tied scoreline; your predicted score must match that tied score and your predicted advancing team must be correct to earn exact score points.

**Example — Final, actual 2–1, pick 2–1, correct winner, advance_bonus 0:**

```
10 (final round) + 0 + 5 exact + 0 fire = 15 points
```

---

## Perfect Day (highlight only)

Perfect Day is a **fun stat**, not a point bonus. It awards **0 points**.

Rules:

1. Look at all **finalized** matches on the same **display calendar date** (America/New_York, matching the app UI — not UTC).
2. Need **at least 2 matches** that day.
3. You must have a **confirmed pick submitted before kickoff** on **every** match that day.
4. You must get **correct result** on **every** match that day (group: right W/D/L; knockout: right advancer).

When all four conditions are met, `perfect_days_count` increments and the player may show **Perfect Day 🎉** on the leaderboard or profile. Pool Highlights can still feature the Perfect Day Club.

---

## Tournament Picks (podium) — pre-tournament

Pick **1st, 2nd, 3rd** place teams before the tournament locks.

Scored only when admin sets actual champion / runner-up / third place.

### Team value formula

```
base_value = round(100 / market_win_percentage)
clamped to 5 … 250
```

Admin can override with `tournament_value_override` on a team.

### Podium partial credit

Each pick slot earns a **percentage of that team's value** based on where the team actually finishes:

**If you picked the team as champion:**

| Actual finish | Credit |
|---------------|--------|
| Champion | 100% |
| Runner-up | 35% |
| Third place | 20% |

**If you picked the team as runner-up:**

| Actual finish | Credit |
|---------------|--------|
| Champion | 25% |
| Runner-up | 45% |
| Third place | 20% |

**If you picked the team as third place:**

| Actual finish | Credit |
|---------------|--------|
| Champion | 15% |
| Runner-up | 15% |
| Third place | 30% |

```
points = round(team_value × credit_percent)
```

**Example:** Team at 1.6% market → value 63 → picked as champion, finishes runner-up → 63 × 0.35 = **22** points.

---

## Finals Challenge (separate leaderboard)

Legacy side pool — **not** added to main `totalPoints`:

| Correct pick | Points |
|--------------|--------|
| Each quarterfinalist | +4 |
| Each semifinalist | +6 |
| Each finalist | +10 |
| Champion | +15 |

---

## Big predictions (legacy)

If still used in data model:

| Pick | Points |
|------|--------|
| Group winner (each group) | +2 |
| Group runner-up | +1 |
| Semifinalist (each) | +8 |
| Finalist (each) | +12 |
| Champion | +25 (+ longshot bonus from champion probability) |
| Top scorer | +10 |

---

## Manual adjustments

Admins can add positive or negative point adjustments per player. These sum directly into `totalPoints`.

---

## Leaderboard tie-breakers

Tie-breakers are used for **display order only**. Prize money uses **pooled splits** (see below).

When total (or provisional) points are tied:

1. More **exact scores**  
2. More **correct results**  
3. More **knockout correct** picks  
4. Higher **tournament pick points** (`beforeCupPoints`)  
5. Closer **final match score prediction** (total goal diff from actual)  
6. Higher **potential points** remaining

## Prize money ties

If players tie in points, prize money for the tied positions is **pooled and split**:

- Two tied for 1st → split 1st + 2nd prize (55% + 25%)
- Two tied for 2nd → split 2nd + 3rd prize (25% + 15%)
- Tied for 3rd → split 3rd prize among tied players

---

## Pick preview labels (UI only)

**Group stage:** max points = 3 + outcome bonus + 5 exact + predicted fire bonus (capped at 18).

**Knockout:** max points = round base + advance bonus + 5 exact + predicted fire bonus.

Based on **maximum possible points** if that exact scoreline hits:

| Max points | Label |
|------------|-------|
| 0–8 | Solid pick |
| 9–12 | Nice pick |
| 13–16 | Brave pick 🔥 |
| 17+ | Miracle pick 🚀 |

---

## Default / missing picks

- If a player **does not save a pick** before kickoff, they earn **0 points** for that match.
- Missing picks are **not** auto-scored as 0–0.

---

## Live scoring (provisional)

While a match is in progress with a synced score:

- Same `scoreMatchPrediction` logic runs with `allowLive: true`.
- Shown as **+N live** on leaderboard and **provisional total**.
- Finalized when match status becomes `final` and scores are recalculated.

---

## Admin-configurable settings

| Setting | Default | Effect |
|---------|---------|--------|
| `exact_score_fire_bonus_enabled` | true | Toggle fire bonus |
| `group_stage_match_point_cap` | 18 | Max points per group game |

Perfect Day is always tracked as a highlight stat; it does not award points.

---

## Quick reference — group stage formula

```
IF wrong outcome (home/away/draw):
  points = 0
ELSE:
  points = 3
  points += outcome_bonus_for_actual_result   // 0–8 from odds
  IF exact score:
    points += 5
    points += fire_bonus                      // 0–4 typical
  points = min(points, group_stage_cap)       // default 18
```

---

## Quick reference — knockout formula

```
IF wrong advancing team:
  points = 0
ELSE:
  points = round_base + advance_bonus
  IF exact score:
    points += 5 + fire_bonus
```

---

## Source files (for developers)

| Logic | File |
|-------|------|
| Match scoring | `lib/scoring.ts` |
| Config, caps, previews | `lib/scoringConfig.ts` |
| Fire bonus tables | `lib/fireBonus.ts` |
| Odds → bonus tiers | `lib/odds/math.ts` |
| Tournament podium value | `lib/tournamentValue.ts` |
| Tests / examples | `lib/scoring.test.ts`, `lib/fireBonus.test.ts` |

---

*Generated from the Family Cup 2026 codebase. Match-specific bonus numbers (home_win_bonus, etc.) are stored per match in the database and may differ from the Mexico example if odds were updated or set manually.*
