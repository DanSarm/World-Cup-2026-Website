import { getStageLabel, isKnockoutStage, type MatchStage } from "./types";

export interface KnockoutRoundCardTheme {
  wrapperClass: string;
  ribbonClass: string;
  label: string;
}

const THEMES: Record<
  Exclude<MatchStage, "group">,
  Omit<KnockoutRoundCardTheme, "label">
> = {
  round_of_32: {
    wrapperClass: "pick-card--r32",
    ribbonClass: "pick-card-ribbon pick-card-ribbon--r32",
  },
  round_of_16: {
    wrapperClass: "pick-card--r16",
    ribbonClass: "pick-card-ribbon pick-card-ribbon--r16",
  },
  quarterfinal: {
    wrapperClass: "pick-card--qf",
    ribbonClass: "pick-card-ribbon pick-card-ribbon--qf",
  },
  semifinal: {
    wrapperClass: "pick-card--sf",
    ribbonClass: "pick-card-ribbon pick-card-ribbon--sf",
  },
  third_place: {
    wrapperClass: "pick-card--third",
    ribbonClass: "pick-card-ribbon pick-card-ribbon--third",
  },
  final: {
    wrapperClass: "pick-card--final",
    ribbonClass: "pick-card-ribbon pick-card-ribbon--final",
  },
};

export function getKnockoutRoundCardTheme(
  stage: MatchStage
): KnockoutRoundCardTheme | null {
  if (!isKnockoutStage(stage)) return null;
  const base = THEMES[stage];
  return {
    ...base,
    label: getStageLabel(stage),
  };
}
