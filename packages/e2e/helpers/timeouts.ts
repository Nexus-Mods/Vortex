const isCI = process.env.CI && (process.env.CI === "1" || process.env.CI === "true");
const scalingFactor = isCI ? 2 : 1;

/** Global defaults applied via playwright.config.ts. */
export const GlobalTimeouts = {
  /** Upper bound on the entire `playwright test` run. */
  GLOBAL: isCI ? min(45) : min(10),
  /** Per-test budget. */
  TEST: sec(30) * scalingFactor,
  /** Default poll budget for web-first assertions (`expect(locator).toBe...`). */
  EXPECT: sec(5),
  /** Default budget for locator actions (`click`, `fill`, `hover`, ...). */
  ACTION: sec(5),
  /** Default budget for navigation (`goto`, `reload`, `waitForLoadState`, ...). */
  NAVIGATION: sec(5),
} as const;

/** Constant values for custom timeouts */
export const Timeouts = {
  /** For assertions or actions that depend on a network round-trip. */
  NETWORK: sec(30) * scalingFactor,
  /** Cold-start and worker fixture setup. */
  LIFECYCLE: min(1) * scalingFactor,
} as const;

function min(x: number): number {
  return x * 1000 * 60;
}

function sec(x: number): number {
  return x * 1000;
}
