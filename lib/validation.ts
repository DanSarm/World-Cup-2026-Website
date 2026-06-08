import { z } from "zod";

export const pinSchema = z
  .string()
  .regex(/^\d{4}$/, "PIN must be 4 digits");

export const displayNameSchema = z
  .string()
  .min(2, "Name too short")
  .max(30, "Name too long")
  .regex(/^[a-zA-Z0-9\s\-'.]+$/, "Invalid characters");

export const familyCodeSchema = z.string().min(1, "Family code required");

export const registerSchema = z.object({
  familyCode: familyCodeSchema,
  displayName: displayNameSchema,
  pin: pinSchema,
  favoriteTeamCode: z
    .union([z.literal(""), z.string().length(3)])
    .optional()
    .nullable(),
  adminInviteCode: z.string().optional(),
});

export const loginSchema = z.object({
  displayName: displayNameSchema,
  pin: pinSchema,
  adminInviteCode: z.string().optional(),
});

export const matchPickSchema = z
  .object({
    matchId: z.string().uuid(),
    predHomeScore: z.number().int().min(0).max(20),
    predAwayScore: z.number().int().min(0).max(20),
    predWinnerTeamId: z.string().uuid().optional().nullable(),
    isKnockout: z.boolean(),
    homeTeamId: z.string().uuid().nullable(),
    awayTeamId: z.string().uuid().nullable(),
  })
  .refine(
    (d) => d.homeTeamId && d.awayTeamId,
    { message: "Teams not set for this match" }
  )
  .refine(
    (d) => {
      if (!d.isKnockout) return true;
      if (d.predHomeScore !== d.predAwayScore) return true;
      return !!d.predWinnerTeamId;
    },
    { message: "Pick who advances for a tied knockout score" }
  );

export const bigPickSchema = z.object({
  groupWinners: z.record(z.string(), z.string().uuid()),
  groupRunnersUp: z.record(z.string(), z.string().uuid()),
  semifinalists: z.array(z.string().uuid()).length(4),
  finalists: z.array(z.string().uuid()).length(2),
  championTeamId: z.string().uuid(),
  topScorer: z.string().max(100).optional().nullable(),
});

export const finalsChallengeSchema = z.object({
  quarterfinalists: z.array(z.string().uuid()).length(8),
  semifinalists: z.array(z.string().uuid()).length(4),
  finalists: z.array(z.string().uuid()).length(2),
  championTeamId: z.string().uuid(),
});

export const payoutSchema = z
  .object({
    overall_first: z.number().min(0).max(100),
    overall_second: z.number().min(0).max(100),
    overall_third: z.number().min(0).max(100),
    exact_score: z.number().min(0).max(100),
    finals_challenge: z.number().min(0).max(100),
    fun_prize: z.number().min(0).max(100),
  })
  .refine(
    (p) =>
      p.overall_first +
        p.overall_second +
        p.overall_third +
        p.exact_score +
        p.finals_challenge +
        p.fun_prize ===
      100,
    { message: "Payout percentages must total 100%" }
  );

export const matchResultSchema = z
  .object({
    matchId: z.string().uuid(),
    homeScore: z.number().int().min(0).max(20),
    awayScore: z.number().int().min(0).max(20),
    winnerTeamId: z.string().uuid().optional().nullable(),
    decidedByPenalties: z.boolean().default(false),
    homeTeamId: z.string().uuid().nullable(),
    awayTeamId: z.string().uuid().nullable(),
    isKnockout: z.boolean(),
  })
  .refine(
    (d) => {
      if (!d.isKnockout) return true;
      if (d.homeScore !== d.awayScore) return true;
      return !!d.winnerTeamId;
    },
    { message: "Knockout tie needs a winner" }
  )
  .refine(
    (d) => {
      if (!d.winnerTeamId) return true;
      return (
        d.winnerTeamId === d.homeTeamId || d.winnerTeamId === d.awayTeamId
      );
    },
    { message: "Winner must be one of the match teams" }
  );
