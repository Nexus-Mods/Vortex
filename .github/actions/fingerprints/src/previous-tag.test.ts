import { describe, expect, it } from "vitest";

import { previousReleaseTag } from "./previous-tag";

const TAGS = [
  "v2.3.0",
  "v2.3.0-beta.1",
  "v2.4.0",
  "v2.4.0-beta.1",
  "v2.4.0-beta.2",
  "v2.4.1",
  "v2.4.2",
  "v2.5.0",
  "v2.5.0-beta.1",
  "v2.5.0-beta.2",
  "v2.6.0",
  "v2.6.0-beta.1",
  "v2.6.0-beta.2",
  "v9.9.9",
  "nightly",
  "some-tag",
];

describe("previousReleaseTag", () => {
  it("beta follows the previous beta in the same line", () => {
    expect(previousReleaseTag(TAGS, "v2.6.0-beta.2", true)).toBe("v2.6.0-beta.1");
  });

  it("first beta of a line crosses to the previous line's last pre-release", () => {
    expect(previousReleaseTag(TAGS, "v2.6.0-beta.1", true)).toBe("v2.5.0-beta.2");
  });

  it("ignores stables on the pre-release channel", () => {
    expect(previousReleaseTag(TAGS, "v2.5.0-beta.1", true)).toBe("v2.4.0-beta.2");
  });

  it("stable follows the previous stable, skipping betas", () => {
    expect(previousReleaseTag(TAGS, "v2.6.0", false)).toBe("v2.5.0");
  });

  it("stable hotfix follows its own line's stable", () => {
    expect(previousReleaseTag(TAGS, "v2.4.2", false)).toBe("v2.4.1");
  });

  it("hotfix of the previous line precedes the next stable", () => {
    expect(previousReleaseTag(TAGS, "v2.5.0", false)).toBe("v2.4.2");
  });

  it("ignores non-version tags", () => {
    expect(previousReleaseTag(TAGS, "v9.9.9", false)).toBe("v2.6.0");
  });

  it("sorts numerically, not lexicographically", () => {
    const tags = ["v2.6.0-beta.1", "v2.6.0-beta.2", "v2.6.0-beta.9", "v2.6.0-beta.10"];
    expect(previousReleaseTag(tags, "v2.6.0-beta.10", true)).toBe("v2.6.0-beta.9");
  });

  it("counts alphas as pre-releases", () => {
    const tags = ["v2.6.0-alpha.1", "v2.6.0-alpha.2", "v2.6.0-beta.1"];
    expect(previousReleaseTag(tags, "v2.6.0-beta.1", true)).toBe("v2.6.0-alpha.2");
  });

  it("returns empty for the first release on a channel", () => {
    expect(previousReleaseTag(["v1.0.0-beta.1"], "v1.0.0", false)).toBe("");
  });

  it("works when the current tag is not in the list yet", () => {
    expect(previousReleaseTag(["v2.4.0", "v2.5.0"], "v2.6.0", false)).toBe("v2.5.0");
  });

  it("rejects a tag that is not a valid version", () => {
    expect(() => previousReleaseTag(TAGS, "nightly", true)).toThrow(
      '"nightly" is not a valid version tag',
    );
  });
});
