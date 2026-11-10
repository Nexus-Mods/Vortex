import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IMod } from "../../types/IMod";

const api = vi.hoisted(() => ({
  emitAndAwait: vi.fn(),
  events: { emit: vi.fn() },
  getState: vi.fn(() => ({ settings: { gameMode: { current: "stardewvalley" } } })),
  showErrorNotification: vi.fn(),
}));

vi.mock("@/contexts", () => ({ useMainContext: () => ({ api }) }));
vi.mock("@/util/selectors", () => ({ activeGameId: () => "stardewvalley" }));

import { useCollectionChangelog, useCollectionRevision } from "./useCollectionRevision.hook";

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

  it("fetches a revision's changelog, once", async () => {
    const slug = `slug-${++slugs}`;
    const { result } = renderHook(() => useCollectionChangelog(slug, 113));
    await waitFor(() =>
      expect(result.current).toEqual({ status: "loaded", changelog: "Fixed things" }),
    );

    const again = renderHook(() => useCollectionChangelog(slug, 113));
    await waitFor(() =>
      expect(again.result.current).toEqual({ status: "loaded", changelog: "Fixed things" }),
    );

    expect(api.emitAndAwait).toHaveBeenCalledTimes(1);
    expect(api.emitAndAwait).toHaveBeenCalledWith("get-nexus-collection-revision", slug, 113);
  });

  it("has an empty changelog for a revision without one", async () => {
    api.emitAndAwait.mockResolvedValue([{ collectionChangelog: { description: "" } }]);
    const slug = `slug-${++slugs}`;
    const { result } = renderHook(() => useCollectionChangelog(slug, 10));

    await waitFor(() => expect(result.current).toEqual({ status: "loaded", changelog: "" }));
  });

  it("says when it couldn't fetch one, and tries again next time", async () => {
    api.emitAndAwait.mockRejectedValueOnce(new Error("offline"));
    const slug = `slug-${++slugs}`;
    const { result } = renderHook(() => useCollectionChangelog(slug, 10));
    await waitFor(() => expect(result.current).toEqual({ status: "failed" }));

    const again = renderHook(() => useCollectionChangelog(slug, 10));
    await waitFor(() =>
      expect(again.result.current).toEqual({ status: "loaded", changelog: "Fixed things" }),
    );
    expect(api.emitAndAwait).toHaveBeenCalledTimes(2);
  });

  it("counts a fetch that comes back with nothing as failed, not as none", async () => {
    api.emitAndAwait.mockResolvedValueOnce([undefined]);
    const slug = `slug-${++slugs}`;
    const { result } = renderHook(() => useCollectionChangelog(slug, 10));
    await waitFor(() => expect(result.current).toEqual({ status: "failed" }));

    const again = renderHook(() => useCollectionChangelog(slug, 10));
    await waitFor(() =>
      expect(again.result.current).toEqual({ status: "loaded", changelog: "Fixed things" }),
    );
  });

  it("drops the last revision's changelog while the next one's coming", async () => {
    const slug = `slug-${++slugs}`;
    const { result, rerender } = renderHook(
      ({ revision }) => useCollectionChangelog(slug, revision),
      { initialProps: { revision: 113 } },
    );
    await waitFor(() =>
      expect(result.current).toEqual({ status: "loaded", changelog: "Fixed things" }),
    );

    api.emitAndAwait.mockReturnValue(new Promise(() => undefined));
    rerender({ revision: 114 });

    expect(result.current).toEqual({ status: "loading" });
  });

  it("fetches nothing until asked for a changelog", () => {
    renderHook(() => useCollectionRevision(collection({ version: "112", newestVersion: "113" })));

    expect(api.emitAndAwait).not.toHaveBeenCalled();
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

  it("leaves saying the update failed to the update, which does", async () => {
    const coll = collection({ version: "112", newestVersion: "113" });
    const { result } = renderHook(() => useCollectionRevision(coll));

    api.events.emit.mockImplementation((...args: unknown[]) =>
      (args.at(-1) as (err: Error) => void)(new Error("offline")),
    );
    await act(() => result.current.update());

    expect(api.showErrorNotification).not.toHaveBeenCalled();
    expect(result.current.updating).toBe(false);
  });

  it("starts one update for the collection, however many of its rows ask", async () => {
    let finish: () => void = () => undefined;
    api.events.emit.mockImplementation((...args: unknown[]) => {
      finish = args.at(-1) as () => void;
    });
    const coll = collection({ version: "112", newestVersion: "113" });
    const group = renderHook(() => useCollectionRevision(coll));
    const row = renderHook(() => useCollectionRevision(coll));

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = group.result.current.update();
    });
    expect(row.result.current.updating).toBe(true);

    await act(() => row.result.current.update());
    expect(api.events.emit).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish();
      await first;
    });
    expect(row.result.current.updating).toBe(false);
  });
});
