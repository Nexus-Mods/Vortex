import { describe, it, expect } from "vitest";

import {
  buildReleaseNotes,
  isStableVersion,
  parseChangelog,
  selectEntriesForVersion,
  toPlainText,
} from "./changelog";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/**
 * Trimmed-down copy of the real CHANGELOG.md covering the shapes that matter:
 * a stable entry with only a prose note, betas with several sections, and a
 * preceding stable release that must terminate the backwards walk.
 */
const CHANGELOG = `# Changelog

All notable changes to this project will be documented in this file.

## [2.4.0] - 2026-07-27

_Stable 2.4 release. See the beta entries below for the full list of changes since 2.3._

## [2.4.0-beta.2] - 2026-07-21

### Fixed

- Collection name shown as the downloaded archive's file name on collection cards ([#23741](https://github.com/Nexus-Mods/Vortex/pull/23741))
- Corrected the import and use of \`removeMods\` ([#23710](https://github.com/Nexus-Mods/Vortex/pull/23710))

## [2.4.0-beta.1] - 2026-07-15

_First beta of the 2.4 release._

### Added

- Health check page: Bulk mod install ([#23642](https://github.com/Nexus-Mods/Vortex/pull/23642))

### Changed

- Health check page: dropped the per-run success toasts in favour of a \`Last updated\` label ([#23688](https://github.com/Nexus-Mods/Vortex/pull/23688))

### Fixed

- Cross-\`modType\` file override editor rendering an empty tree ([#23676](https://github.com/Nexus-Mods/Vortex/pull/23676))
- Downloads showing their internal \`__vortex_tmp_\` name ([#23657](https://github.com/Nexus-Mods/Vortex/pull/23657))

## [2.3.0] - 2026-07-14

_Stable 2.3 release._

### Fixed

- Paused downloads with no usable checkpoint failing to resume ([#23630](https://github.com/Nexus-Mods/Vortex/pull/23630))

## [2.3.0-beta.1] - 2026-07-01

### Added

- Staging and version indicator in the title bar ([#23590](https://github.com/Nexus-Mods/Vortex/pull/23590))
`;

// ---------------------------------------------------------------------------
// isStableVersion
// ---------------------------------------------------------------------------

describe("isStableVersion", () => {
  it.each(["2.4.0", "2.1.1", "10.0.0"])("treats %s as stable", (version) => {
    expect(isStableVersion(version)).toBe(true);
  });

  it.each(["2.4.0-beta.1", "2.4.0-rc.1", "Unreleased", "2.4"])(
    "treats %s as not stable",
    (version) => {
      expect(isStableVersion(version)).toBe(false);
    },
  );
});

// ---------------------------------------------------------------------------
// parseChangelog
// ---------------------------------------------------------------------------

describe("parseChangelog", () => {
  it("returns entries in document order", () => {
    const entries = parseChangelog(CHANGELOG);
    expect(entries.map((entry) => entry.version)).toEqual([
      "2.4.0",
      "2.4.0-beta.2",
      "2.4.0-beta.1",
      "2.3.0",
      "2.3.0-beta.1",
    ]);
  });

  it("groups bullets by section", () => {
    const beta1 = parseChangelog(CHANGELOG).find((e) => e.version === "2.4.0-beta.1");
    expect([...(beta1?.sections.keys() ?? [])]).toEqual(["Added", "Changed", "Fixed"]);
    expect(beta1?.sections.get("Fixed")).toHaveLength(2);
  });

  it("ignores prose notes that are not bullets", () => {
    const stable = parseChangelog(CHANGELOG).find((e) => e.version === "2.4.0");
    expect(stable?.sections.size).toBe(0);
  });

  it("folds indented continuation lines into the preceding bullet", () => {
    const entries = parseChangelog(
      ["## [1.0.0]", "", "### Fixed", "", "- First line", "  second line", ""].join("\n"),
    );
    expect(entries[0]?.sections.get("Fixed")).toEqual(["First line second line"]);
  });

  it("handles CRLF line endings", () => {
    const entries = parseChangelog("## [1.0.0]\r\n\r\n### Fixed\r\n\r\n- A fix\r\n");
    expect(entries[0]?.sections.get("Fixed")).toEqual(["A fix"]);
  });
});

// ---------------------------------------------------------------------------
// selectEntriesForVersion
// ---------------------------------------------------------------------------

describe("selectEntriesForVersion", () => {
  const entries = parseChangelog(CHANGELOG);

  it("collects a stable release and its betas, stopping at the previous stable", () => {
    const selected = selectEntriesForVersion(entries, "2.4.0");
    expect(selected.map((entry) => entry.version)).toEqual([
      "2.4.0",
      "2.4.0-beta.2",
      "2.4.0-beta.1",
    ]);
  });

  it("stops immediately when the preceding entry is already stable", () => {
    const selected = selectEntriesForVersion(entries, "2.3.0");
    expect(selected.map((entry) => entry.version)).toEqual(["2.3.0", "2.3.0-beta.1"]);
  });

  it("collects cumulative entries when publishing a beta", () => {
    const selected = selectEntriesForVersion(entries, "2.4.0-beta.2");
    expect(selected.map((entry) => entry.version)).toEqual(["2.4.0-beta.2", "2.4.0-beta.1"]);
  });

  it("throws for a version with no changelog entry", () => {
    expect(() => selectEntriesForVersion(entries, "2.5.0")).toThrow(
      /No CHANGELOG.md entry found for version 2\.5\.0/,
    );
  });
});

// ---------------------------------------------------------------------------
// toPlainText
// ---------------------------------------------------------------------------

describe("toPlainText", () => {
  it("collapses a PR link to its label", () => {
    expect(toPlainText("A fix ([#23741](https://github.com/Nexus-Mods/Vortex/pull/23741))")).toBe(
      "A fix (#23741)",
    );
  });

  it("strips code spans and bold markers", () => {
    expect(toPlainText("Corrected the use of `removeMods` in **main**")).toBe(
      "Corrected the use of removeMods in main",
    );
  });

  it("preserves underscores that are part of identifiers", () => {
    expect(toPlainText("Downloads showing their internal `__vortex_tmp_` name")).toBe(
      "Downloads showing their internal __vortex_tmp_ name",
    );
  });
});

// ---------------------------------------------------------------------------
// buildReleaseNotes
// ---------------------------------------------------------------------------

describe("buildReleaseNotes", () => {
  it("flattens the release into Added / Changed / Fixed order, newest entry first", () => {
    expect(buildReleaseNotes(CHANGELOG, "2.4.0")).toBe(
      [
        "Health check page: Bulk mod install (#23642)",
        "Health check page: dropped the per-run success toasts in favour of a Last updated label (#23688)",
        "Collection name shown as the downloaded archive's file name on collection cards (#23741)",
        "Corrected the import and use of removeMods (#23710)",
        "Cross-modType file override editor rendering an empty tree (#23676)",
        "Downloads showing their internal __vortex_tmp_ name (#23657)",
      ].join("\n"),
    );
  });

  it("does not leak entries from the previous release", () => {
    expect(buildReleaseNotes(CHANGELOG, "2.4.0")).not.toContain("#23630");
  });

  it("orders sections by Keep a Changelog convention, not document order", () => {
    const markdown = [
      "## [1.0.0]",
      "",
      "### Fixed",
      "",
      "- A fix",
      "",
      "### Added",
      "",
      "- A feature",
      "",
    ].join("\n");
    expect(buildReleaseNotes(markdown, "1.0.0")).toBe("A feature\nA fix");
  });

  it("appends unrecognised sections after the known ones", () => {
    const markdown = [
      "## [1.0.0]",
      "",
      "### Internal",
      "",
      "- Some chore",
      "",
      "### Fixed",
      "",
      "- A fix",
      "",
    ].join("\n");
    expect(buildReleaseNotes(markdown, "1.0.0")).toBe("A fix\nSome chore");
  });

  it("returns an empty string for a release with no bullets", () => {
    expect(buildReleaseNotes("## [1.0.0]\n\n_Nothing to see here._\n", "1.0.0")).toBe("");
  });
});
