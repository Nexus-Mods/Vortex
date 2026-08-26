import { describe, expect, it, vi } from "vitest";

import { makeApiHarness, makeAvailableExtension, makeDownload } from "../../test-utils/builders";
import type { IExtensionApi } from "../../types/IExtensionContext";
import { fetchExtensionList } from "./availableExtensions";
import installExtension from "./installExtension";
import { downloadAndInstallExtension, selectorMatch } from "./util";

vi.mock("./availableExtensions", () => ({
  fetchExtensionList: vi.fn(),
  dedupeGameExtensions: (extensions: unknown) => extensions,
  groupGameExtensionsByGameId: () => new Map(),
}));

vi.mock("./installExtension", () => ({ default: vi.fn() }));

vi.mock("../nexus_integration/util", () => ({
  nexusGames: () => [],
  nexusGamesProm: async () => [],
}));

vi.mock("../download_management/selectors", () => ({
  downloadPathForGame: () => "C:/downloads/site",
}));

describe("selectorMatch", () => {
  const ext = makeAvailableExtension({ modId: 42, fileId: 7 });

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

describe("downloadAndInstallExtension", () => {
  it("installs a downloaded archive even when the catalog fetch fails", async () => {
    vi.mocked(fetchExtensionList).mockRejectedValueOnce(new Error("endpoint unavailable"));

    const harness = makeApiHarness({
      downloads: { "dl-1": makeDownload({ id: "dl-1", localPath: "some-extension.7z" }) },
    });
    harness.api.emitAndAwait = vi.fn(async () => [
      "dl-1",
    ]) as unknown as IExtensionApi["emitAndAwait"];

    const result = await downloadAndInstallExtension(harness.api, {
      name: "Some Extension",
      modId: 42,
      fileId: 7,
    });

    expect(result).toBe(true);
    expect(vi.mocked(installExtension)).toHaveBeenCalledWith(
      harness.api,
      expect.stringContaining("some-extension.7z"),
      expect.objectContaining({ catalogEntry: undefined }),
    );
  });
});
