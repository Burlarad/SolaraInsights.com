/**
 * Regression Guard: Tarot must not appear on public Home screen
 *
 * Tarot is a protected Sanctuary-only feature. This test ensures
 * no one accidentally re-adds TarotArena to the public Home page.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Public Home Page - Tarot Guard", () => {
  const homePath = join(process.cwd(), "app/(public)/archive/home/page.tsx");
  const content = readFileSync(homePath, "utf-8");

  it("should NOT import TarotArena", () => {
    expect(content).not.toContain("TarotArena");
  });

  it("should NOT contain 'Ask the Cards' UI text", () => {
    expect(content).not.toContain("Ask the Cards");
  });

  it("should NOT reference /api/public-tarot", () => {
    expect(content).not.toContain("public-tarot");
  });
});
