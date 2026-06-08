/** FIFA 3-letter codes → flagcdn.com ISO codes (incl. gb-eng, gb-sct). */
const FIFA_TO_ISO: Record<string, string> = {
  MEX: "mx",
  RSA: "za",
  KOR: "kr",
  CZE: "cz",
  CAN: "ca",
  BIH: "ba",
  QAT: "qa",
  SUI: "ch",
  BRA: "br",
  MAR: "ma",
  HAI: "ht",
  SCO: "gb-sct",
  USA: "us",
  PAR: "py",
  AUS: "au",
  TUR: "tr",
  GER: "de",
  CUW: "cw",
  CIV: "ci",
  ECU: "ec",
  NED: "nl",
  JPN: "jp",
  SWE: "se",
  TUN: "tn",
  BEL: "be",
  EGY: "eg",
  IRN: "ir",
  NZL: "nz",
  ESP: "es",
  CPV: "cv",
  KSA: "sa",
  URU: "uy",
  FRA: "fr",
  SEN: "sn",
  IRQ: "iq",
  NOR: "no",
  ARG: "ar",
  ALG: "dz",
  AUT: "at",
  JOR: "jo",
  POR: "pt",
  COD: "cd",
  UZB: "uz",
  COL: "co",
  ENG: "gb-eng",
  CRO: "hr",
  GHA: "gh",
  PAN: "pa",
};

/** Display sizes (CSS). CDN only serves w20, w40, w80, w160, … — not arbitrary widths. */
export type FlagSize = "xs" | "sm" | "md" | "lg" | "xl";

/** Pixel width requested from flagcdn.com (must be a supported size). */
export const FLAG_CDN_WIDTH: Record<FlagSize, number> = {
  xs: 20,
  sm: 40,
  md: 40,
  lg: 80,
  xl: 80,
};

/** Retina srcSet width (also must be a supported CDN size). */
export const FLAG_CDN_WIDTH_2X: Record<FlagSize, number> = {
  xs: 40,
  sm: 80,
  md: 80,
  lg: 160,
  xl: 160,
};

export function fifaToIso(fifaCode: string): string | null {
  return FIFA_TO_ISO[fifaCode.toUpperCase()] ?? null;
}

export function flagImageUrl(fifaCode: string, width: number): string {
  const iso = fifaToIso(fifaCode);
  if (!iso) return "";
  return `https://flagcdn.com/w${width}/${iso}.png`;
}

export function flagImageUrlForSize(fifaCode: string, size: FlagSize = "md"): string {
  return flagImageUrl(fifaCode, FLAG_CDN_WIDTH[size]);
}

export function flagImageUrl2xForSize(fifaCode: string, size: FlagSize = "md"): string {
  return flagImageUrl(fifaCode, FLAG_CDN_WIDTH_2X[size]);
}

export function allFifaCodes(): string[] {
  return Object.keys(FIFA_TO_ISO);
}
