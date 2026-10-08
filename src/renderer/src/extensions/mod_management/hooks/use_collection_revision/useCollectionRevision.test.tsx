import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserCanceled } from "@/util/CustomErrors";

import type { IMod } from "../../types/IMod";

const api = vi.hoisted(() => ({
  emitAndAwait: vi.fn(),
  events: { emit: vi.fn() },
  getState: vi.fn(() => ({ settings: { gameMode: { current: "stardewvalley" } } })),
  showErrorNotification: vi.fn(),
}));

vi.mock("@/contexts", () => ({ useMainContext: () => ({ api }) }));
vi.mock("@/util/selectors", () => ({ activeGameId: () => "stardewvalley" }));

import { useCollectionRevision } from "./useCollectionRevision.hook";

let slugs = 0;

// A slug of its own each time, as changelogs are kept for the session by slug.
const collection = (attributes: object): IMod =>
  ({
    id: "coll",
    type: "collection",
    attributes: { collectionSlug: `slug-${++slugs}`, source: "nexus", ...attributes },
  }) as unknown as IMod;

describe("useCollectionRevision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.emitAndAwait.mockResolvedValue([{ collectionChangelog: { description: "Fixed things" } }]);
  });

  it("knows a newer revision is out", () => {
    const { result } = renderHook(() =>
      useCollectionRevision(collection({ version: "112", newestVersion: "113" })),
    );

    expect(result.current).toMatchObject({ revision: 112, newest: 113, hasUpdate: true });
  });

  it("has nothing to update to while it's the newest", () => {
    const { result } = renderHook(() =>
      useCollectionRevision(collection({ version: "10", newestVersion: "10" })),
    );

    expect(result.current.hasUpdate).toBe(false);
  });

  it("fetches the newest revision's changelog, once", async () => {
    const coll = collection({ version: "112", newestVersion: "113" });
    const { result } = renderHook(() => useCollectionRevision(coll));
    await waitFor(() => expect(result.current.changelog).toBe("Fixed things"));

    const again = renderHook(() => useCollectionRevision(coll));
    await waitFor(() => expect(again.result.current.changelog).toBe("Fixed things"));

    expect(api.emitAndAwait).toHaveBeenCalledTimes(1);
    expect(api.emitAndAwait).toHaveBeenCalledWith(
      "get-nexus-collection-revision",
      coll.attributes.collectionSlug,
      113,
    );
  });

  it("has no changelog for a revision without one", async () => {
    api.emitAndAwait.mockResolvedValue([{ collectionChangelog: { description: "" } }]);
    const { result } = renderHook(() => useCollectionRevision(collection({ version: "10" })));

    await waitFor(() => expect(api.emitAndAwait).toHaveBeenCalled());
    expect(result.current.changelog).toBeUndefined();
  });

  it("updates as the collection's own Update does", async () => {
    api.events.emit.mockImplementation((...args: unknown[]) => (args.at(-1) as () => void)());
    const coll = collection({ version: "112", newestVersion: "113" });
    const { result } = renderHook(() => useCollectionRevision(coll));

    await act(() => result.current.update());

    expect(api.events.emit).toHaveBeenCalledWith(
      "collection-update",
      "stardewvalley",
      coll.attributes.collectionSlug,
      "113",
      "nexus",
      "coll",
      expect.any(Function),
    );
    expect(result.current.updating).toBe(false);
  });

  it("says when the update fails, but not when the user cancels it", async () => {
    const coll = collection({ version: "112", newestVersion: "113" });
    const { result } = renderHook(() => useCollectionRevision(coll));

    api.events.emit.mockImplementation((...args: unknown[]) =>
      (args.at(-1) as (err: Error) => void)(new UserCanceled()),
    );
    await act(() => result.current.update());
    expect(api.showErrorNotification).not.toHaveBeenCalled();

    api.events.emit.mockImplementation((...args: unknown[]) =>
      (args.at(-1) as (err: Error) => void)(new Error("offline")),
    );
    await act(() => result.current.update());
    expect(api.showErrorNotification).toHaveBeenCalledWith(
      "Failed to update collection",
      expect.any(Error),
    );
  });
});
