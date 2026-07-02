import { describe, expect, it } from "vitest";

import mapWithConcurrency from "./mapWithConcurrency";

describe("mapWithConcurrency", () => {
  it("returns results in input order", async () => {
    const result = await mapWithConcurrency([1, 2, 3, 4], async (n) => n * 2, 2);
    expect(result).toEqual([2, 4, 6, 8]);
  });

  it("passes the index to the callback", async () => {
    const result = await mapWithConcurrency(["a", "b", "c"], (item, idx) => `${idx}:${item}`, 2);
    expect(result).toEqual(["0:a", "1:b", "2:c"]);
  });

  it("returns an empty array for empty input", async () => {
    expect(await mapWithConcurrency([], async (x) => x, 4)).toEqual([]);
  });

  it("never runs more than `concurrency` callbacks at once", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const release: Array<() => void> = [];

    const promise = mapWithConcurrency(
      [0, 1, 2, 3, 4, 5],
      (n) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        return new Promise<number>((resolve) => {
          release.push(() => {
            inFlight -= 1;
            resolve(n);
          });
        });
      },
      2,
    );

    // drain the gated callbacks one at a time; each release frees a worker to pick up the next item.
    while (release.length > 0) {
      release.shift()!();
      await Promise.resolve();
    }
    await promise;

    expect(maxInFlight).toBe(2);
  });
});
