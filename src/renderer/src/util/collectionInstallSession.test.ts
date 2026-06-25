import { describe, expect, it } from "vitest";

import { makeDownload, makeMod, makeRule, makeSession, modsByRule } from "../test-utils/builders";
import { freeUserDownloadPosition, reconstructModStatus } from "./collectionInstallSession";

describe("reconstructModStatus", () => {
  it('rehydrates an ignored rule as the terminal "ignored" status so a skip survives a restart', () => {
    // The durable `ignored` flag is the only record of a skip once the session is
    // gone; without this, a skipped required mod would come back as "pending" and
    // the collection could never reach completion.
    expect(reconstructModStatus(makeRule({ ignored: true }), undefined, undefined)).toBe("ignored");
  });

  it('"ignored" takes precedence over an installed mod / present download', () => {
    expect(reconstructModStatus(makeRule({ ignored: true }), makeMod(), makeDownload())).toBe(
      "ignored",
    );
  });

  it('an installed mod is "installed"', () => {
    expect(reconstructModStatus(makeRule(), makeMod({ state: "installed" }), undefined)).toBe(
      "installed",
    );
  });

  it('a mid-install mod is "installing", not "installed", until the install completes', () => {
    expect(reconstructModStatus(makeRule(), makeMod({ state: "installing" }), undefined)).toBe(
      "installing",
    );
  });

  it('a finished download with no mod is "downloaded"', () => {
    expect(reconstructModStatus(makeRule(), undefined, makeDownload({ state: "finished" }))).toBe(
      "downloaded",
    );
  });

  it('an unfinished download with no mod is "downloading"', () => {
    expect(reconstructModStatus(makeRule(), undefined, makeDownload({ state: "started" }))).toBe(
      "downloading",
    );
  });

  it('a bundled rule with no mod or download is "downloaded"', () => {
    // bundled mods ship inside the collection archive, so there is no separate download
    expect(
      reconstructModStatus(
        makeRule({ extra: { localPath: "bundled/mod.7z" } }),
        undefined,
        undefined,
      ),
    ).toBe("downloaded");
  });

  it('an untouched rule is "pending"', () => {
    expect(reconstructModStatus(makeRule(), undefined, undefined)).toBe("pending");
  });
});

describe("freeUserDownloadPosition", () => {
  it("counts resolved members + the current one against the total", () => {
    const session = makeSession({
      totalRequired: 4,
      mods: modsByRule([
        { ruleId: "r1", status: "downloaded" },
        { ruleId: "r2", status: "installed" },
        { ruleId: "r3", status: "downloading" }, // currently shown, not yet resolved
        { ruleId: "r4", status: "pending" },
      ]),
    });
    // two resolved (downloaded + installed) + 1 for the current download
    expect(freeUserDownloadPosition(session)).toEqual({ position: 3, total: 4 });
  });

  it("advances on a skip (ignored counts as resolved)", () => {
    const skipped = makeSession({
      totalRequired: 3,
      mods: modsByRule([
        { ruleId: "r1", status: "ignored" },
        { ruleId: "r2", status: "downloading" },
        { ruleId: "r3", status: "pending" },
      ]),
    });
    expect(freeUserDownloadPosition(skipped).position).toBe(2);
  });

  it("never overshoots the total once every download has been resolved (no 101/100)", () => {
    const session = makeSession({
      totalRequired: 2,
      mods: modsByRule([
        { ruleId: "r1", status: "installed" },
        { ruleId: "r2", status: "downloaded" },
      ]),
    });
    // resolved (2) + 1 would be 3/2; clamped to the total
    expect(freeUserDownloadPosition(session)).toEqual({ position: 2, total: 2 });
  });

  it("reads 1/total at the very start when nothing has been resolved yet", () => {
    const session = makeSession({
      totalRequired: 3,
      mods: modsByRule([
        { ruleId: "r1", status: "downloading" },
        { ruleId: "r2", status: "pending" },
        { ruleId: "r3", status: "pending" },
      ]),
    });
    expect(freeUserDownloadPosition(session)).toEqual({ position: 1, total: 3 });
  });

  it("counts both required and optional members in the total", () => {
    const session = makeSession({
      totalRequired: 2,
      totalOptional: 1,
      mods: modsByRule([
        { ruleId: "r1", status: "installed", type: "requires" },
        { ruleId: "r2", status: "pending", type: "requires" },
        { ruleId: "r3", status: "pending", type: "recommends" },
      ]),
    });
    expect(freeUserDownloadPosition(session)).toEqual({ position: 2, total: 3 });
  });

  it("clamps the total to at least 1 so an empty session never divides oddly", () => {
    expect(freeUserDownloadPosition(makeSession())).toEqual({ position: 1, total: 1 });
  });
});
