import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/extensions/nexus_integration/nexusV3Client", () => ({
  createVortexNexusV3Client: vi.fn(),
}));

import { createVortexNexusV3Client } from "@/extensions/nexus_integration/nexusV3Client";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { getModDetails } from "./modDetails";

const mockCreateClient = vi.mocked(createVortexNexusV3Client);
const api = { getState: () => ({}) } as unknown as IExtensionApi;

/** A raw v3 mod-detail row, as /mods/batch returns it. */
function modRow(id: string) {
  return {
    id,
    game_id: "1303",
    name: `Mod ${id}`,
    summary: "",
    status: "published",
    thumbnail_url: null,
    adult_content: false,
  };
}

/** A fake client whose getModsBatch echoes a row for each requested id. */
function clientWithModsBatch() {
  const getModsBatch = vi.fn((ids: string[]) => Promise.resolve(ids.map(modRow)));
  mockCreateClient.mockReturnValue({ getModsBatch } as unknown as ReturnType<
    typeof createVortexNexusV3Client
  >);
  return getModsBatch;
}

// getModDetails caches by uid across runs; each test uses a distinct id prefix
// so the shared (module-level) cache doesn't leak between cases.
describe("getModDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns [] without hitting the endpoint for an empty id list", async () => {
    const getModsBatch = clientWithModsBatch();
    expect(await getModDetails(api, [])).toEqual([]);
    expect(getModsBatch).not.toHaveBeenCalled();
  });

  test("splits >2000 mod ids into chunked /mods/batch calls and maps to IModDetails", async () => {
    const getModsBatch = clientWithModsBatch();
    const ids = Array.from({ length: 4500 }, (_, i) => `chunk-${i}`);

    const details = await getModDetails(api, ids);

    expect(getModsBatch).toHaveBeenCalledTimes(3);
    expect(getModsBatch.mock.calls.map((c) => c[0].length)).toEqual([2000, 2000, 500]);
    expect(details).toHaveLength(4500);
    expect(details[0]).toEqual({
      modUID: "chunk-0",
      modName: "Mod chunk-0",
      modSummary: "",
      thumbnailUrl: undefined,
      adultContent: false,
    });
  });

  test("caches mod details and reuses them on the next run", async () => {
    const getModsBatch = clientWithModsBatch();
    const ids = ["cache-a", "cache-b"];

    await getModDetails(api, ids);
    expect(getModsBatch).toHaveBeenCalledTimes(1);

    // Second run with the same ids is fully served from cache: no new request.
    await getModDetails(api, ids);
    expect(getModsBatch).toHaveBeenCalledTimes(1);
  });

  test("only fetches the uncached misses, leaving previously cached ids untouched", async () => {
    const getModsBatch = clientWithModsBatch();

    await getModDetails(api, ["miss-a", "miss-b"]);
    expect(getModsBatch).toHaveBeenCalledTimes(1);

    await getModDetails(api, ["miss-a", "miss-b", "miss-c"]);
    expect(getModsBatch).toHaveBeenCalledTimes(2);
    expect(getModsBatch.mock.calls[1][0]).toEqual(["miss-c"]);
  });
});
