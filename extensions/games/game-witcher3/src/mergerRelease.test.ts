import { describe, expect, it } from "vitest";

import {
  type IGithubRelease,
  type IMergerRelease,
  latestMergerRelease,
  mergerDownloadProblem,
} from "./mergerRelease";

const DOWNLOAD_ROOT = "https://github.com/IDCs/WitcherScriptMerger/releases/download";
const ARCHIVE_SIZE = 100_728_223;

function release(tag: string, overrides: Partial<IGithubRelease> = {}): IGithubRelease {
  const version = tag.replace(/^v/, "");
  const name = `WitcherScriptMerger-${version}.7z`;
  return {
    tag_name: tag,
    name: `WitcherScriptMerger ${version}`,
    prerelease: false,
    assets: [{ name, size: ARCHIVE_SIZE, browser_download_url: `${DOWNLOAD_ROOT}/${tag}/${name}` }],
    ...overrides,
  };
}

describe("latestMergerRelease", () => {
  it("picks the newest release by tag regardless of listing order", () => {
    const picked = latestMergerRelease([release("v0.6.5"), release("v0.7.0"), release("v0.6.6")]);

    expect(picked).toEqual({
      version: "0.7.0",
      fileName: "WitcherScriptMerger-0.7.0.7z",
      downloadLink: `${DOWNLOAD_ROOT}/v0.7.0/WitcherScriptMerger-0.7.0.7z`,
      size: ARCHIVE_SIZE,
    });
  });

  it("reads the version from the tag, not the release name", () => {
    // Release names are not versions, so older Vortex builds skip them.
    expect(latestMergerRelease([release("v0.7.0", { name: "anything" })])?.version).toBe("0.7.0");
  });

  it("finds the archive by name rather than position", () => {
    const withNotes = release("v0.7.0");
    withNotes.assets.unshift({ name: "notes.txt", size: 1, browser_download_url: "notes" });

    expect(latestMergerRelease([withNotes])?.fileName).toBe("WitcherScriptMerger-0.7.0.7z");
  });

  it("installs only releases that are versioned, published and at least 0.6.5", () => {
    const picked = latestMergerRelease([
      release("v0.6.5"),
      release("tools-1.0.0"),
      release("v0.8.0", { prerelease: true }),
      release("v0.6.4"),
      release("v0.9.0", { assets: [] }),
    ]);

    expect(picked?.version).toBe("0.6.5");
  });

  it("installs only plain major.minor.patch tags", () => {
    // The prerelease flag is set by hand, so the tag has to carry the rule too.
    const picked = latestMergerRelease([
      release("v0.6.5"),
      release("v0.7.0-rc.1"),
      release("v0.8.0+build.1"),
    ]);

    expect(picked?.version).toBe("0.6.5");
  });

  it("returns nothing when no release qualifies", () => {
    expect(latestMergerRelease([])).toBeUndefined();
    expect(latestMergerRelease([release("tools-1.0.0")])).toBeUndefined();
  });
});

describe("mergerDownloadProblem", () => {
  const picked = latestMergerRelease([release("v0.7.0")]) as IMergerRelease;

  it("accepts a complete download", () => {
    expect(mergerDownloadProblem(200, ARCHIVE_SIZE, picked)).toBeUndefined();
  });

  it("rejects a response that is not a successful download", () => {
    expect(mergerDownloadProblem(404, ARCHIVE_SIZE, picked)).toMatch(/404/);
  });

  it("rejects a download whose size differs from the published asset", () => {
    expect(mergerDownloadProblem(200, ARCHIVE_SIZE - 1, picked)).toMatch(/size/);
  });
});
