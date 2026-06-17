import { describe, expect, it } from "vitest";

import { makeDownload, makeMod, makeRule } from "../test-utils/builders";
import { reconstructModStatus } from "./collectionInstallSession";

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
