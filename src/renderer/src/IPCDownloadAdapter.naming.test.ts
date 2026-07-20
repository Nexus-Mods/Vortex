import { describe, expect, vi } from "vitest";

import { initDownload, setDownloadModInfo } from "./extensions/download_management/actions/state";
import { test } from "./test-utils/downloadAdapterTest";

// Keep the download off disk. access must reject so the "already downloaded" probe
// treats the file as absent and the download proceeds to the seed path.
vi.mock(import("node:fs/promises"), async (importOriginal) => ({
  ...(await importOriginal()),
  mkdir: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockRejectedValue(new Error("ENOENT")),
  rename: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
}));

// let the fired-and-forgotten start-download handler run to completion
const flush = async () => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
  }
};

const modInfoAction = (
  h: { dispatched: Array<{ type: string; payload?: unknown }> },
  key: string,
) =>
  h.dispatched.filter(
    (a) =>
      a.type === setDownloadModInfo("", "", "").type && (a.payload as { key: string }).key === key,
  );

describe("start-download name seeding (GH #23718)", () => {
  test("does not overwrite a modInfo name already provided by the caller", async ({
    makeDownloadAdapter,
  }) => {
    const h = makeDownloadAdapter();
    const storagePathHint = "5c/d3/1f/5cd31ffe-41b5-4520-8ac2-cc796226941e";

    h.events.emit(
      "start-download",
      ["https://cdn.example/file.bin"],
      { game: "skyrimse", source: "nexus", name: "Fix Flickering Particles" },
      storagePathHint,
      () => undefined,
    );
    await h.started.promise;
    await flush();

    const inits = h.dispatched.filter((a) => a.type === initDownload("", [], {}, []).type);
    expect(inits).toHaveLength(1);
    expect((inits[0].payload as { modInfo: { name: string } }).modInfo.name).toBe(
      "Fix Flickering Particles",
    );
    expect(modInfoAction(h, "name")).toHaveLength(0);
  });

  test("still seeds the hint when the caller provided no name", async ({ makeDownloadAdapter }) => {
    const h = makeDownloadAdapter();

    h.events.emit(
      "start-download",
      ["https://cdn.example/file.bin"],
      { game: "skyrimse" },
      "MyMod-1234.zip",
      () => undefined,
    );
    await h.started.promise;
    await flush();

    const nameSeeds = modInfoAction(h, "name");
    expect(nameSeeds).toHaveLength(1);
    expect((nameSeeds[0].payload as { value: string }).value).toBe("MyMod-1234.zip");
  });
});
