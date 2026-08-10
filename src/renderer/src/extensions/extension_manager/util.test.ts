import { describe, expect, it } from "vitest";

import type { IAvailableExtension } from "../../types/extensions";
import { filterInstallableExtensions, selectorMatch } from "./util";

function makeExtension(overrides: Partial<IAvailableExtension> = {}): IAvailableExtension {
  return {
    name: "Some Extension",
    description: { short: "short", long: "long" },
    image: "image.png",
    author: "someone",
    uploader: "someone",
    version: "1.0.0",
    downloads: 0,
    endorsements: 0,
    timestamp: 0,
    tags: [],
    ...overrides,
  };
}

describe("filterInstallableExtensions", () => {
  it("keeps extensions with both modId and fileId", () => {
    const extensions = [makeExtension({ modId: 1, fileId: 2 })];
    expect(filterInstallableExtensions(extensions)).toEqual(extensions);
  });

  it("drops extensions missing modId", () => {
    const extensions = [makeExtension({ fileId: 2 })];
    expect(filterInstallableExtensions(extensions)).toEqual([]);
  });

  it("drops extensions missing fileId", () => {
    const extensions = [makeExtension({ modId: 1 })];
    expect(filterInstallableExtensions(extensions)).toEqual([]);
  });

  it("drops legacy GitHub-hosted entries lacking both modId and fileId", () => {
    const extensions = [makeExtension({})];
    expect(filterInstallableExtensions(extensions)).toEqual([]);
  });

  it("keeps only the qualifying entries out of a mixed list", () => {
    const nexusExt = makeExtension({ name: "Nexus Extension", modId: 1, fileId: 2 });
    const githubExt = makeExtension({ name: "GitHub Extension" });
    const partialExt = makeExtension({ name: "Partial Extension", modId: 3 });

    expect(filterInstallableExtensions([nexusExt, githubExt, partialExt])).toEqual([nexusExt]);
  });

  it("returns an empty array unchanged", () => {
    expect(filterInstallableExtensions([])).toEqual([]);
  });
});

describe("selectorMatch", () => {
  const ext = makeExtension({ modId: 42, fileId: 7 });

  it("matches on modId", () => {
    expect(selectorMatch(ext, { modId: 42 })).toBe(true);
  });

  it("does not match a different modId", () => {
    expect(selectorMatch(ext, { modId: 1 })).toBe(false);
  });

  it("returns false when the selector is undefined", () => {
    expect(selectorMatch(ext, undefined)).toBe(false);
  });
});
