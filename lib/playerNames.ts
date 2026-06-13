/** Trim and collapse whitespace for player display names. */
export function normalizeDisplayName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function normalizedDisplayNameKey(name: string): string {
  return normalizeDisplayName(name).toLowerCase();
}

export function displayNamesMatch(a: string, b: string): boolean {
  return normalizedDisplayNameKey(a) === normalizedDisplayNameKey(b);
}
