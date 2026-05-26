import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { describe, it, expect, vi } from "vitest";

import {
  assertStableRelease,
  findInstallerAsset,
  findLatestStableTag,
  versionFromTag,
  preparePublish,
  type GithubRelease,
  type ReleaseAsset,
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

  it("reports stale/inconsistent state for prerelease", () => {
    const release = makeRelease({ isPrerelease: true });
    expect(() => assertStableRelease(release)).toThrow(/marked as prerelease.*inconsistent/);
  });

  it("passes for stable release", () => {
    const stableRelease = makeRelease({ isDraft: false, isPrerelease: false });
    expect(() => assertStableRelease(stableRelease)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// findLatestStableTag
// ---------------------------------------------------------------------------

describe("findLatestStableTag", () => {
  it("returns the tag name of the latest stable release", () => {
    const fakeGhRun = vi.fn().mockReturnValue(JSON.stringify([{ tagName: "v1.2.3" }]));
    const tag = findLatestStableTag(fakeGhRun);
    expect(tag).toBe("v1.2.3");
    expect(fakeGhRun).toHaveBeenCalledWith([
      "release",
      "list",
      "--exclude-pre-releases",
      "--exclude-drafts",
      "--json",
      "tagName",
      "--limit",
      "1",
    ]);
  });

  it("throws when no stable releases exist", () => {
    const fakeGhRun = vi.fn().mockReturnValue("[]");
    expect(() => findLatestStableTag(fakeGhRun)).toThrow(/No stable.*releases found/);
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
    const fakeGhRun = vi.fn().mockImplementation((args: string[]) => {
      if (args[1] === "list") {
        return JSON.stringify([{ tagName: "v2.0.0" }]);
      }
      // release view or release download
      return JSON.stringify(
        makeRelease({
          tagName: "v2.0.0",
          body: "Changelog content",
        }),
      );
    });
    const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), "prepare-test-"));
    const githubOutput = path.join(downloadDir, "output");

    const plan = await preparePublish({
      dryRun,
      modSlug: "site",
      fileGroupId: "5293",
      ghRun: fakeGhRun,
      downloadDir,
      githubOutput,
    });

    expect(plan.tagName).toBe("v2.0.0");
    expect(plan.version).toBe("2.0.0");
    expect(plan.installerName).toBe("Vortex-1-2-3.exe");
    expect(plan.installerPath).toBe(path.join(downloadDir, "Vortex-1-2-3.exe"));
    expect(plan.body).toBe("Changelog content");
    expect(plan.isDraft).toBe(false);
    expect(plan.isPrerelease).toBe(false);
    expect(plan.dryRun).toBe(dryRun);
    expect(plan.modSlug).toBe("site");
    expect(plan.fileGroupId).toBe("5293");

    // For dry-run, ghRun should not be called for download
    if (dryRun) {
      expect(fakeGhRun).toHaveBeenCalledTimes(2); // release list + release view
      expect(fakeGhRun).not.toHaveBeenCalledWith(expect.arrayContaining(["download"]));
    } else {
      expect(fakeGhRun).toHaveBeenCalledTimes(3); // release list + release view + download
    }

    fs.rmSync(downloadDir, { recursive: true });
  });

  it("writes GITHUB_OUTPUT keys", async () => {
    const fakeGhRun = vi.fn().mockImplementation((args: string[]) => {
      if (args[1] === "list") {
        return JSON.stringify([{ tagName: "v1.2.3" }]);
      }
      return JSON.stringify(makeRelease());
    });
    const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), "prepare-test-"));
    const githubOutput = path.join(downloadDir, "github_output");

    await preparePublish({
      dryRun: true,
      modSlug: "site",
      fileGroupId: "5293",
      ghRun: fakeGhRun,
      downloadDir,
      githubOutput,
    });

    const output = fs.readFileSync(githubOutput, "utf8");
    expect(output).toContain("tag=v1.2.3");
    expect(output).toContain("version=1.2.3");
    expect(output).toContain(`installer-path=${path.join(downloadDir, "Vortex-1-2-3.exe")}`);
    expect(output).toContain("installer-name=Vortex-1-2-3.exe");

    fs.rmSync(downloadDir, { recursive: true });
  });

  it("writes multiline body with heredoc syntax", async () => {
    const multilineBody = "Line 1\nLine 2\n\nLine 4";
    const fakeGhRun = vi.fn().mockImplementation((args: string[]) => {
      if (args[1] === "list") {
        return JSON.stringify([{ tagName: "v1.2.3" }]);
      }
      return JSON.stringify(makeRelease({ body: multilineBody }));
    });
    const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), "prepare-test-"));
    const githubOutput = path.join(downloadDir, "github_output");

    await preparePublish({
      dryRun: true,
      modSlug: "site",
      fileGroupId: "5293",
      ghRun: fakeGhRun,
      downloadDir,
      githubOutput,
    });

    const output = fs.readFileSync(githubOutput, "utf8");
    expect(output).toContain("body<<EOF");
    expect(output).toContain(multilineBody);
    expect(output).toContain("EOF");

    fs.rmSync(downloadDir, { recursive: true });
  });

  it("skips writing GITHUB_OUTPUT when githubOutput option is omitted", async () => {
    const fakeGhRun = vi.fn().mockImplementation((args: string[]) => {
      if (args[1] === "list") {
        return JSON.stringify([{ tagName: "v1.2.3" }]);
      }
      return JSON.stringify(makeRelease());
    });

    // Should not throw even without githubOutput
    const plan = await preparePublish({
      dryRun: true,
      modSlug: "site",
      fileGroupId: "5293",
      ghRun: fakeGhRun,
      downloadDir: os.tmpdir(),
    });

    expect(plan.tagName).toBe("v1.2.3");
  });

  it("throws when ghRun returns draft release JSON", async () => {
    const fakeGhRun = vi.fn().mockImplementation((args: string[]) => {
      if (args[1] === "list") {
        return JSON.stringify([{ tagName: "v1.2.3" }]);
      }
      return JSON.stringify(makeRelease({ isDraft: true }));
    });

    await expect(
      preparePublish({
        dryRun: true,
        modSlug: "site",
        fileGroupId: "5293",
        ghRun: fakeGhRun,
        downloadDir: os.tmpdir(),
      }),
    ).rejects.toThrow(/draft/);
  });

  it("throws when release JSON has no .exe asset", async () => {
    const fakeGhRun = vi.fn().mockImplementation((args: string[]) => {
      if (args[1] === "list") {
        return JSON.stringify([{ tagName: "v1.2.3" }]);
      }
      return JSON.stringify(
        makeRelease({
          assets: [{ name: "latest.yml", url: "https://example.com/latest.yml" }],
        }),
      );
    });

    await expect(
      preparePublish({
        dryRun: true,
        modSlug: "site",
        fileGroupId: "5293",
        ghRun: fakeGhRun,
        downloadDir: os.tmpdir(),
      }),
    ).rejects.toThrow(/No .exe installer asset found/);
  });
});
