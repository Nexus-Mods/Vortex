import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { IModDetails } from "@/extensions/health_check/types";
import { makeFileInfo } from "@/test-utils/builders";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { getModFilesWithCache } from "./modFiles";

// A plain function, not a vi.fn: a spy attaches its own handlers to the promise it returns
// (to record settled results), which would mask exactly the leak these tests are about.
const details = vi.hoisted(() => ({
  next: (): Promise<IModDetails[]> => Promise.resolve<IModDetails[]>([]),
}));
vi.mock("@/extensions/health_check/utils/shared/modDetails", () => ({
  getModDetails: () => details.next(),
}));

// A numeric game id keeps makeModUID from consulting the game registry.
const GAME_ID = "1704";

function apiWithModFiles(nexusGetModFiles: () => Promise<unknown>): IExtensionApi {
  return { ext: { nexusGetModFiles } } as unknown as IExtensionApi;
}

/** Let any orphaned rejection reach the unhandled-rejection listeners before the test ends. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// getModFilesWithCache caches by game + mod id across runs; each test uses a distinct mod id.
describe("getModFilesWithCache", () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => {
    unhandled.push(reason);
  };

  beforeEach(() => {
    unhandled.length = 0;
    process.on("unhandledRejection", onUnhandled);
  });

  afterEach(() => {
    process.off("unhandledRejection", onUnhandled);
  });

  test("a failed details lookup does not leak when the files call returns nothing", async () => {
    details.next = () => Promise.reject(new Error("HTTP 401"));
    const api = apiWithModFiles(() => Promise.resolve([]));

    await expect(getModFilesWithCache(api, GAME_ID, 101)).resolves.toEqual([]);
    await flush();
    expect(unhandled).toEqual([]);
  });

  test("a failed details lookup does not leak when the files call throws", async () => {
    details.next = () => Promise.reject(new Error("HTTP 429"));
    const api = apiWithModFiles(() => Promise.reject(new Error("HTTP 429")));

    await expect(getModFilesWithCache(api, GAME_ID, 102)).rejects.toThrow("HTTP 429");
    await flush();
    expect(unhandled).toEqual([]);
  });

  test("returns main files without display data when the details lookup fails", async () => {
    details.next = () => Promise.reject(new Error("HTTP 401"));
    const api = apiWithModFiles(() =>
      Promise.resolve([makeFileInfo({ file_id: 7, category_id: 1 })]),
    );

    const files = await getModFilesWithCache(api, GAME_ID, 103);

    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ fileId: 7, adultContent: false, thumbnailUrl: undefined });
  });
});
