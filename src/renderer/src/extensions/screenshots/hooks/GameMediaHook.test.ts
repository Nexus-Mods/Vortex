import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import collectMedia from "../util/collectMedia";
import type { GameMediaItem } from "../util/mediaTypes";
import useGameMedia, { PAGE_SIZE } from "./GameMediaHook";
import useGameMediaSources from "./GameMediaSourcesHook";
import useGameMediaWatcher from "./GameMediaWatcherHook";

const { dispatch, state, store, discovery, game, activeGameIdMock } = vi.hoisted(() => {
  const dispatch = vi.fn();
  const state = {
    persistent: { game_media: { sources: {}, modTags: {}, disabledSources: {}, flags: {} } },
    session: { game_media: { items: [] as GameMediaItem[] | null } },
  };

  return {
    dispatch,
    state,
    store: { dispatch, getState: () => state },
    discovery: { path: "C:/game" },
    game: { id: "game-1", name: "Test Game" },
    activeGameIdMock: vi.fn((): string | undefined => "game-1"),
  };
});

vi.mock("react-redux", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useSelector: (selector: (s: unknown) => unknown) => selector(state),
  useStore: () => store,
}));

vi.mock("@/util/selectors", () => ({
  activeGameId: activeGameIdMock,
  gameById: () => game,
  currentGameDiscovery: () => discovery,
}));

vi.mock("./GameMediaSourcesHook", () => ({ default: vi.fn() }));
vi.mock("./GameMediaWatcherHook", () => ({ default: vi.fn() }));
vi.mock("../util/collectMedia", () => ({
  default: vi.fn(),
  sortMedia: (a: GameMediaItem, b: GameMediaItem) =>
    (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
}));

const mockedUseGameMediaSources = vi.mocked(useGameMediaSources);
const mockedUseGameMediaWatcher = vi.mocked(useGameMediaWatcher);
const mockedCollectMedia = vi.mocked(collectMedia);

const item = (id: string, sourceId = "default"): GameMediaItem => ({
  id,
  name: `${id}.jpg`,
  path: `images/${id}.jpg`,
  sourceId,
  type: "image",
});

const seedItems = (items: GameMediaItem[] | null) => {
  state.session.game_media.items = items;
};

const render = (tab = "all") =>
  renderHook(({ tab }) => useGameMedia(tab), { initialProps: { tab } });

describe("GameMediaHook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseGameMediaSources.mockReturnValue({
      allSources: { default: { name: "Default", path: "images" } },
      defaultSources: { default: { name: "Default", path: "images" } },
      customSources: undefined,
      disabledSources: [],
      flags: {},
    });
    mockedCollectMedia.mockResolvedValue([]);
    activeGameIdMock.mockReturnValue("game-1");
    seedItems(null);
  });

  it("scans on mount and stores the result", async () => {
    const found = [item("1")];
    mockedCollectMedia.mockResolvedValue(found);

    render();

    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "SET_FOUND_GAME_MEDIA",
        payload: { media: found },
      }),
    );
  });

  it("does not re-scan on unrelated re-renders", async () => {
    const hook = render();
    await waitFor(() => expect(mockedCollectMedia).toHaveBeenCalledOnce());

    hook.rerender({ tab: "all" });
    hook.rerender({ tab: "all" });

    expect(mockedCollectMedia).toHaveBeenCalledOnce();
  });

  it("sets isLoading around the scan", async () => {
    let resolveScan!: (items: GameMediaItem[]) => void;

    mockedCollectMedia.mockReturnValue(
      new Promise<GameMediaItem[]>((resolve) => {
        resolveScan = resolve;
      }),
    );

    const hook = render();

    await waitFor(() => expect(hook.result.current.isLoading).toBe(true));

    await act(async () => {
      resolveScan([item("1")]);
    });

    expect(hook.result.current.isLoading).toBe(false);
  });

  it("surfaces a scan failure", async () => {
    const mockError = new Error("Example error");
    mockedCollectMedia.mockRejectedValue(mockError);

    const hook = render();

    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(hook.result.current.error?.message).toBe(mockError.message);
  });

  it("ignores a scan that resolves after an unmount", async () => {
    let resolveScan!: (items: GameMediaItem[]) => void;
    mockedCollectMedia.mockReturnValue(
      new Promise<GameMediaItem[]>((resolve) => {
        resolveScan = resolve;
      }),
    );

    const hook = render();
    await waitFor(() => expect(mockedCollectMedia).toHaveBeenCalledOnce());

    hook.unmount();

    await act(async () => {
      resolveScan([item("1")]);
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("skips the scan with no game or discovery", () => {
    activeGameIdMock.mockReturnValue(undefined);

    render();

    expect(mockedCollectMedia).not.toHaveBeenCalled();
  });

  it("re-runs the scan on forceCollect", async () => {
    const hook = render();
    await waitFor(() => expect(mockedCollectMedia).toHaveBeenCalledOnce());
    dispatch.mockClear();

    const refreshed = [item("2")];
    mockedCollectMedia.mockResolvedValue(refreshed);

    await act(async () => {
      await hook.result.current.forceCollect();
    });

    expect(mockedCollectMedia).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { media: refreshed } }),
    );
  });

  it("paginates correctly", async () => {
    seedItems(Array.from({ length: 30 }, (_, i) => item(String(i))));

    const hook = render();

    expect(hook.result.current.pageSize).toEqual(PAGE_SIZE);
    expect(hook.result.current.total).toEqual(30);

    await act(async () => hook.result.current.setPage(2));

    expect(hook.result.current.page).toBe(2);
    expect(hook.result.current.pageItems.length).toEqual(30 - PAGE_SIZE);
  });

  it("clamps the page when the list of results shrinks", async () => {
    seedItems(Array.from({ length: 30 }, (_, i) => item(String(i))));
    const hook = render();

    await act(async () => hook.result.current.setPage(2));
    expect(hook.result.current.page).toBe(2);

    seedItems([item("only")]);
    hook.rerender({ tab: "all" });

    await waitFor(() => expect(hook.result.current.page).toBe(1));
    expect(hook.result.current.pageItems).toHaveLength(1);
  });

  it("keeps the page state per-tab", async () => {
    seedItems([
      ...Array.from({ length: 30 }, (_, i) => item(String(i), "screenshots")),
      ...Array.from({ length: 30 }, (_, i) => item(`v${i}`, "videos")),
    ]);

    const hook = render("screenshots");
    await act(async () => hook.result.current.setPage(2));
    expect(hook.result.current.page).toBe(2);

    hook.rerender({ tab: "videos" });
    expect(hook.result.current.page).toBe(1);

    hook.rerender({ tab: "screenshots" });
    expect(hook.result.current.page).toBe(2);
  });

  it("only replaces a single source when rescanSource is called", async () => {
    seedItems([item("a", "screenshots"), item("b", "videos")]);
    mockedUseGameMediaSources.mockReturnValue({
      allSources: {
        screenshots: { name: "Screenshots", path: "shots" },
        videos: { name: "Videos", path: "vids" },
      },
      defaultSources: {},
      customSources: undefined,
      disabledSources: [],
      flags: {},
    });

    const hook = render();
    await waitFor(() => expect(mockedUseGameMediaWatcher).toHaveBeenCalled());
    dispatch.mockClear();

    const onSourceChanged = mockedUseGameMediaWatcher.mock.lastCall[2];
    mockedCollectMedia.mockResolvedValue([item("c", "videos")]);

    await act(async () => {
      onSourceChanged("videos");
    });

    expect(mockedCollectMedia).toHaveBeenCalledWith(
      { videos: { name: "Videos", path: "vids" } },
      [],
      {},
    );

    expect(dispatch).toHaveBeenCalledWith({
      error: false,
      payload: { media: [item("c", "videos")], sourceId: "videos" },
      type: "REPLACE_SOURCE_GAME_MEDIA",
    });

    hook.unmount();
  });
});
