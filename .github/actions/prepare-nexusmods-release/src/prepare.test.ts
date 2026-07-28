import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { describe, it, expect, vi } from "vitest";

import {
  assertStableRelease,
  findInstallerAsset,
  versionFromTag,
  preparePublish,
  type GithubRelease,
} from "./prepare";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const makeRelease = (overrides: Partial<GithubRelease> = {}): GithubRelease => ({
  tagName: "v1.2.3",
  name: "Vortex 1.2.3",
  body: "Release notes here",
  assets: [
    { name: "Vortex-1-2-3.exe", url: "https://example.com/Vortex-1-2-3.exe" },
    { name: "latest.yml", url: "https://example.com/latest.yml" },
  ],
  isDraft: false,
  isPrerelease: false,
  ...overrides,
});

/**
 * Writes a minimal CHANGELOG.md covering every version the fixtures publish,
 * and returns its path.
 */
const makeChangelog = (dir: string): string => {
  const changelogPath = path.join(
    fs.mkdtempSync(path.join(dir, "prepare-changelog-")),
    "CHANGELOG.md",
  );
  fs.writeFileSync(
    changelogPath,
    [
      "# Changelog",
      "",
      "## [2.0.0] - 2026-01-02",
      "",
      "### Fixed",
      "",
      "- A 2.0.0 fix ([#2](https://github.com/Nexus-Mods/Vortex/pull/2))",
      "",
      "## [1.2.3] - 2026-01-01",
      "",
      "### Fixed",
      "",
      "- A 1.2.3 fix ([#1](https://github.com/Nexus-Mods/Vortex/pull/1))",
      "",
    ].join("\n"),
  );
  return changelogPath;
};

// ---------------------------------------------------------------------------
// assertStableRelease
// ---------------------------------------------------------------------------

describe("assertStableRelease", () => {
  it.each([
    { name: "draft", release: makeRelease({ isDraft: true }) },
    { name: "prerelease", release: makeRelease({ isPrerelease: true }) },
  ])("throws for $name release", ({ release }) => {
    expect(() => assertStableRelease(release)).toThrow();
  });

  it("explains that only stable releases reach Nexus Mods", () => {
    const release = makeRelease({ isPrerelease: true });
    expect(() => assertStableRelease(release)).toThrow(/Only stable releases/);
  });

  it("passes for stable release", () => {
    const stableRelease = makeRelease({ isDraft: false, isPrerelease: false });
    expect(() => assertStableRelease(stableRelease)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// findInstallerAsset
// ---------------------------------------------------------------------------

describe("findInstallerAsset", () => {
  it("selects first .exe asset", () => {
    const release = makeRelease({
      assets: [
        { name: "Vortex-1-2-3.exe", url: "https://example.com/Vortex-1-2-3.exe" },
        { name: "Other.exe", url: "https://example.com/Other.exe" },
      ],
    });
    expect(findInstallerAsset(release).name).toBe("Vortex-1-2-3.exe");
  });

  it("throws when no .exe asset exists", () => {
    const release = makeRelease({
      assets: [{ name: "latest.yml", url: "https://example.com/latest.yml" }],
    });
    expect(() => findInstallerAsset(release)).toThrow(/No .exe installer asset found/);
  });

  it("ignores non-.exe assets", () => {
    const release = makeRelease({
      assets: [
        { name: "latest.yml", url: "https://example.com/latest.yml" },
        { name: "Vortex-1-2-3.exe", url: "https://example.com/Vortex-1-2-3.exe" },
      ],
    });
    expect(findInstallerAsset(release).name).toBe("Vortex-1-2-3.exe");
  });
});

// ---------------------------------------------------------------------------
// versionFromTag
// ---------------------------------------------------------------------------

describe("versionFromTag", () => {
  it("strips leading 'v' from 'v1.2.3'", () => {
    expect(versionFromTag("v1.2.3")).toBe("1.2.3");
  });

  it("returns tag unchanged when no leading 'v'", () => {
    expect(versionFromTag("1.2.3")).toBe("1.2.3");
  });
});

// ---------------------------------------------------------------------------
// preparePublish
// ---------------------------------------------------------------------------

describe("preparePublish", () => {
  it.each([
    { name: "dry-run", dryRun: true },
    { name: "live", dryRun: false },
  ])("returns correct PublishPlan for $name", async ({ dryRun }) => {
    const fakeGhRun = vi
      .fn()
      .mockImplementation(() =>
        JSON.stringify(makeRelease({ tagName: "v2.0.0", body: "Changelog content" })),
      );
    const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), "prepare-test-"));

    const plan = await preparePublish({
      dryRun,
      tag: "v2.0.0",
      changelogPath: makeChangelog(downloadDir),
      ghRun: fakeGhRun,
      downloadDir,
    });

    expect(plan.tagName).toBe("v2.0.0");
    expect(plan.version).toBe("2.0.0");
    expect(plan.installerName).toBe("Vortex-1-2-3.exe");
    expect(plan.installerPath).toBe(path.join(downloadDir, "Vortex-1-2-3.exe"));
    expect(plan.body).toBe("Changelog content");
    expect(plan.isDraft).toBe(false);
    expect(plan.isPrerelease).toBe(false);
    expect(plan.dryRun).toBe(dryRun);
    // The Nexus changelog comes from CHANGELOG.md, not the release body
    expect(plan.changelog).toBe("A 2.0.0 fix (#2)");

    if (dryRun) {
      expect(fakeGhRun).toHaveBeenCalledTimes(1); // release view only
      expect(fakeGhRun).not.toHaveBeenCalledWith(expect.arrayContaining(["download"]));
    } else {
      expect(fakeGhRun).toHaveBeenCalledTimes(2); // release view + download
    }

    fs.rmSync(downloadDir, { recursive: true });
  });

  it("views the requested tag and never lists releases", async () => {
    const fakeGhRun = vi.fn().mockImplementation(() => JSON.stringify(makeRelease()));

    await preparePublish({
      dryRun: true,
      tag: "v1.2.3",
      changelogPath: makeChangelog(os.tmpdir()),
      ghRun: fakeGhRun,
      downloadDir: os.tmpdir(),
    });

    expect(fakeGhRun).toHaveBeenCalledWith(expect.arrayContaining(["view", "v1.2.3"]));
    expect(fakeGhRun).not.toHaveBeenCalledWith(expect.arrayContaining(["list"]));
  });

  it("throws when the version has no CHANGELOG.md entry", async () => {
    const fakeGhRun = vi
      .fn()
      .mockImplementation(() => JSON.stringify(makeRelease({ tagName: "v9.9.9" })));

    await expect(
      preparePublish({
        dryRun: true,
        tag: "v9.9.9",
        changelogPath: makeChangelog(os.tmpdir()),
        ghRun: fakeGhRun,
        downloadDir: os.tmpdir(),
      }),
    ).rejects.toThrow(/No CHANGELOG.md entry found/);
  });

  it("throws when ghRun returns draft release JSON", async () => {
    const fakeGhRun = vi
      .fn()
      .mockImplementation(() => JSON.stringify(makeRelease({ isDraft: true })));

    await expect(
      preparePublish({
        dryRun: true,
        tag: "v1.2.3",
        changelogPath: makeChangelog(os.tmpdir()),
        ghRun: fakeGhRun,
        downloadDir: os.tmpdir(),
      }),
    ).rejects.toThrow(/is a draft/);
  });

  it("throws when release JSON has no .exe asset", async () => {
    const fakeGhRun = vi
      .fn()
      .mockImplementation(() =>
        JSON.stringify(
          makeRelease({ assets: [{ name: "latest.yml", url: "https://example.com/latest.yml" }] }),
        ),
      );

    await expect(
      preparePublish({
        dryRun: true,
        tag: "v1.2.3",
        changelogPath: makeChangelog(os.tmpdir()),
        ghRun: fakeGhRun,
        downloadDir: os.tmpdir(),
      }),
    ).rejects.toThrow(/No .exe installer asset found/);
  });
});
