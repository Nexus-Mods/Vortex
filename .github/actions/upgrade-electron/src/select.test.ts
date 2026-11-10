import { describe, expect, it } from "vitest";

import { type NpmPackument } from "./schemas";
import { newestNodeAbi, newestRelease } from "./select";
import { DAY, MINUTE, NOW, release } from "./test-fixtures";

const MIN_AGE = 1440 * MINUTE;

describe("newestRelease", () => {
  it("picks the newest release of the same major", () => {
    const releases = [
      release("45.0.0", "24.22.0", 10 * DAY),
      release("45.1.0", "24.22.1", 2 * DAY),
      release("45.0.5", "24.22.0", 5 * DAY),
    ];
    expect(newestRelease(releases, "45.0.0", MIN_AGE, NOW)?.version).toBe("45.1.0");
  });

  it("sorts numerically, not lexically", () => {
    const releases = [release("45.9.0", "24.22.0"), release("45.10.0", "24.22.1")];
    expect(newestRelease(releases, "45.0.0", MIN_AGE, NOW)?.version).toBe("45.10.0");
  });

  it("never crosses a major", () => {
    const releases = [release("46.0.0", "26.0.0"), release("44.10.0", "24.22.1")];
    expect(newestRelease(releases, "45.0.0", MIN_AGE, NOW)).toBeUndefined();
  });

  it("ignores pre-releases", () => {
    const releases = [
      release("45.1.0-beta.1", "24.22.1"),
      release("45.1.0-nightly.20261020", "24.22.1"),
    ];
    expect(newestRelease(releases, "45.0.0", MIN_AGE, NOW)).toBeUndefined();
  });

  it("ignores releases that are not newer than the current one", () => {
    const releases = [release("45.0.0", "24.22.0"), release("44.9.0", "24.20.0")];
    expect(newestRelease(releases, "45.0.0", MIN_AGE, NOW)).toBeUndefined();
  });

  it("requires the minimum age, inclusive", () => {
    const young = release("45.1.0", "24.22.1", MIN_AGE - 1);
    const exact = release("45.1.1", "24.22.1", MIN_AGE);
    expect(newestRelease([young], "45.0.0", MIN_AGE, NOW)).toBeUndefined();
    expect(newestRelease([young, exact], "45.0.0", MIN_AGE, NOW)?.version).toBe("45.1.1");
  });

  it("falls back to the date when there is no timestamp", () => {
    const old = { version: "45.1.0", node: "24.22.1", date: "2026-10-01" };
    expect(newestRelease([old], "45.0.0", MIN_AGE, NOW)?.version).toBe("45.1.0");
  });

  it("skips releases with an unparseable date", () => {
    const broken = { version: "45.1.0", node: "24.22.1", date: "not a date" };
    expect(newestRelease([broken], "45.0.0", MIN_AGE, NOW)).toBeUndefined();
  });
});

/** A node-abi packument whose versions were published `ageMs` before NOW. */
const packument = (published: Record<string, number>): NpmPackument => ({
  versions: Object.fromEntries(Object.keys(published).map((version) => [version, {}])),
  time: {
    created: "2020-01-01T00:00:00.000Z",
    ...Object.fromEntries(
      Object.entries(published).map(([version, ageMs]) => [
        version,
        new Date(NOW - ageMs).toISOString(),
      ]),
    ),
  },
});

describe("newestNodeAbi", () => {
  it("picks the newest eligible version", () => {
    const doc = packument({ "4.35.0": 90 * DAY, "4.36.0": 30 * DAY, "4.36.1": 2 * DAY });
    expect(newestNodeAbi(doc, "4.35.0", MIN_AGE, NOW)).toBe("4.36.1");
  });

  it("skips versions that are too young", () => {
    const doc = packument({ "4.35.0": 90 * DAY, "4.36.0": 30 * DAY, "4.36.1": MIN_AGE - 1 });
    expect(newestNodeAbi(doc, "4.35.0", MIN_AGE, NOW)).toBe("4.36.0");
  });

  it("skips pre-releases and versions without a publish time", () => {
    const doc = packument({ "4.35.0": 90 * DAY, "4.36.0-beta.1": 30 * DAY });
    doc.versions["4.37.0"] = {};
    expect(newestNodeAbi(doc, "4.35.0", MIN_AGE, NOW)).toBeUndefined();
  });

  it("returns undefined when nothing is newer", () => {
    const doc = packument({ "4.34.0": 90 * DAY, "4.35.0": 60 * DAY });
    expect(newestNodeAbi(doc, "4.35.0", MIN_AGE, NOW)).toBeUndefined();
  });
});
