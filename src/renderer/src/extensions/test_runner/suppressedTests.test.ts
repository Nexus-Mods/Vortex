import { describe, expect, it, vi } from "vitest";

import { skipWhileSuppressed, withSuppressedTests } from "./suppressedTests";

// a suppression held until the returned release is called
function hold(tests: string[]): { released: Promise<void>; release: () => void } {
  let release: () => void = () => undefined;
  const released = withSuppressedTests(
    tests,
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  return { released, release };
}

describe("withSuppressedTests", () => {
  it("runs a check triggered while suppressed once the suppression lifts", async () => {
    const { released, release } = hold(["plugins-changed"]);
    const run = vi.fn();

    expect(skipWhileSuppressed("plugins-changed", run)).toBe(true);
    expect(run).not.toHaveBeenCalled();

    release();
    await released;

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("runs nothing on release when no check was triggered", async () => {
    const { released, release } = hold(["mod-installed"]);
    release();
    await released;

    expect(skipWhileSuppressed("mod-installed", vi.fn())).toBe(false);
  });

  it("runs the skipped check only when the last overlapping suppression lifts", async () => {
    const outer = hold(["settings-changed"]);
    const inner = hold(["settings-changed"]);
    const run = vi.fn();
    skipWhileSuppressed("settings-changed", run);

    inner.release();
    await inner.released;
    expect(run).not.toHaveBeenCalled();

    outer.release();
    await outer.released;
    expect(run).toHaveBeenCalledTimes(1);
  });
});
