import { describe, expect, it } from "vitest";
import { isNavActive } from "./navConfig";

describe("isNavActive", () => {
  it("matches home exactly", () => {
    expect(isNavActive("/", "/")).toBe(true);
    expect(isNavActive("/picks", "/")).toBe(false);
  });

  it("matches nested routes under a tab", () => {
    expect(isNavActive("/player/abc", "/leaderboard")).toBe(false);
    expect(isNavActive("/admin/settings", "/admin")).toBe(true);
  });
});
