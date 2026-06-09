import fs from "fs";

const text = fs.readFileSync(
  "C:/Users/danie/.cursor/projects/c-Users-danie-Documents-Other-2026-World-Cup/agent-tools/d1b496c0-1dad-4c56-8031-38cac7b93eb5.txt",
  "utf8"
);

const rows = [];
for (const line of text.split("\n")) {
  const m = line.match(
    /^\| (\d+) \| ([A-L](?: \| [A-L]){7}) \| (3[A-L](?: \| 3[A-L]){7}) \|/
  );
  if (m) {
    const groups = m[2]
      .split(" | ")
      .map((s) => s.trim())
      .sort()
      .join("");
    const slots = m[3].split(" | ").map((s) => s.trim().replace("3", ""));
    rows.push([
      groups,
      slots[0],
      slots[1],
      slots[2],
      slots[3],
      slots[4],
      slots[5],
      slots[6],
      slots[7],
    ]);
  }
}

const entries = rows
  .map(
    (r) =>
      `  "${r[0]}": { A: "${r[1]}", B: "${r[2]}", D: "${r[3]}", E: "${r[4]}", G: "${r[5]}", I: "${r[6]}", K: "${r[7]}", L: "${r[8]}" }`
  )
  .join(",\n");

const out = `/** FIFA 2026 Annex C — third-place slot assignments (495 combinations). Auto-generated. */
export type WinnerSlot = "A" | "B" | "D" | "E" | "G" | "I" | "K" | "L";

export type ThirdPlaceMapping = Record<WinnerSlot, string>;

export const THIRD_PLACE_COMBINATIONS: Record<string, ThirdPlaceMapping> = {
${entries}
};
`;

fs.writeFileSync("lib/thirdPlaceCombinations.ts", out);
console.log("wrote", rows.length, "entries");
