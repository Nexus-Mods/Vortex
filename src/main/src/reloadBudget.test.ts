import { describe, expect, it } from "vitest";

import { ReloadBudget } from "./reloadBudget";

describe("ReloadBudget", () => {
  it("allows up to max reloads inside the window and refuses the next", () => {
    const budget = new ReloadBudget(3, 60_000);

    expect(budget.allow(0)).toBe(true);
    expect(budget.allow(10)).toBe(true);
    expect(budget.allow(20)).toBe(true);
    expect(budget.allow(30)).toBe(false);
    expect(budget.count).toBe(4);
  });

  it("forgets deaths older than the window", () => {
    const budget = new ReloadBudget(2, 1_000);

    expect(budget.allow(0)).toBe(true);
    expect(budget.allow(100)).toBe(true);
    expect(budget.allow(200)).toBe(false);
    // a minute later only the new death counts
    expect(budget.allow(61_000)).toBe(true);
    expect(budget.count).toBe(1);
  });

  it("keeps refusing while deaths keep arriving inside the window", () => {
    const budget = new ReloadBudget(1, 1_000);

    expect(budget.allow(0)).toBe(true);
    for (let t = 15; t < 1_000; t += 15) {
      expect(budget.allow(t)).toBe(false);
    }
  });
});
