/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { GameMediaSource } from "../util/mediaTypes";
import useGameMediaSources from "./GameMediaSourcesHook";

const {
  state,
  discovery,
  game,
  activeGameIdMock,
  sourcesByDiscoveryMock,
  currentGameDiscoverMock,
  mockUseSelector,
} = vi.hoisted(() => {
  const state = {
    persistent: { game_media: { sources: {}, modTags: {}, disabledSources: {}, flags: {} } },
  };

  return {
    state,
    discovery: { path: "C:/game", store: "steam" },
    game: { id: "game-1", name: "Test Game", details: { steamAppId: 1 } },
    activeGameIdMock: vi.fn((): string | undefined => "game-1"),
    sourcesByDiscoveryMock: vi.fn(
      (
        _game: any,
        _discovery: any,
        _flags?: { showVideos?: boolean },
      ): Record<string, GameMediaSource> => ({}),
    ),
    currentGameDiscoverMock: vi.fn(() => discovery),
    mockUseSelector: vi.fn(),
  };
});

vi.mock("react-redux", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useSelector: mockUseSelector,
}));

vi.mock("../../../util/selectors", () => ({
  activeGameId: activeGameIdMock,
  gameById: () => game,
  currentGameDiscovery: currentGameDiscoverMock,
}));

vi.mock("../util/sourcesByDiscovery", () => ({
  default: sourcesByDiscoveryMock,
}));

const render = () => renderHook(() => useGameMediaSources());

describe("GameMediaSourcesHook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.persistent.game_media.sources = {};
    activeGameIdMock.mockReturnValue("game-1");
    currentGameDiscoverMock.mockReturnValue(discovery);
    mockUseSelector.mockImplementation((selector: (s: unknown) => unknown) => selector(state));
  });

  it("merges defaults with custom sources, custom winning on an id clash", async () => {
    sourcesByDiscoveryMock.mockResolvedValue({
      sourceA: { name: "Source A", path: "A" },
      sourceB: { name: "Source B", path: "B" },
    });

    state.persistent.game_media.sources["game-1"] = {
      customSourceA: { name: "Custom Source A", path: "AA" },
      customSourceB: { name: "Custom Source B", path: "BB" },
      sourceB: { name: "Custom Source B Override", path: "BBB" },
    };

    const hook = render();

    expect(sourcesByDiscoveryMock).toHaveBeenCalledWith(game, discovery, {});

    await waitFor(() => expect(Object.keys(hook.result.current.allSources).length).toBe(4));

    expect(hook.result.current.allSources["sourceB"].name).toBe("Custom Source B Override");
  });

  it("clears defaults when the game changes to one with no discovery", async () => {
    sourcesByDiscoveryMock.mockResolvedValue({
      sourceA: { name: "Source A", path: "A" },
      sourceB: { name: "Source B", path: "B" },
    });

    const hook = render();

    await waitFor(() =>
      expect(Object.keys(hook.result.current.defaultSources)).toEqual(["sourceA", "sourceB"]),
    );

    currentGameDiscoverMock.mockReturnValueOnce(undefined);
    activeGameIdMock.mockReturnValueOnce(undefined);

    hook.rerender();
    await waitFor(() => expect(hook.result.current.defaultSources).toEqual({}));
  });

  it("allSources keeps a stable reference across re-renders when nothing changed", async () => {
    sourcesByDiscoveryMock.mockResolvedValue({
      sourceA: { name: "Source A", path: "A" },
      sourceB: { name: "Source B", path: "B" },
    });

    state.persistent.game_media.sources["game-1"] = {
      customSourceA: { name: "Custom Source A", path: "AA" },
    };

    const hook = render();
    await waitFor(() => expect(Object.keys(hook.result.current.allSources)).toHaveLength(3));

    const allSources = hook.result.current.allSources;

    hook.rerender();
    hook.rerender();

    expect(hook.result.current.allSources).toBe(allSources);
  });

  it("swallows sourcesByDiscovery failures and falls back to {}", async () => {
    sourcesByDiscoveryMock.mockResolvedValue({ sourceA: { name: "Source A", path: "A" } });

    const hook = render();
    await waitFor(() =>
      expect(Object.keys(hook.result.current.defaultSources)).toEqual(["sourceA"]),
    );

    sourcesByDiscoveryMock.mockRejectedValue(new Error("Failed!"));
    currentGameDiscoverMock.mockReturnValue({ path: "D:/other", store: "steam" });

    hook.rerender();

    await waitFor(() => expect(hook.result.current.defaultSources).toEqual({}));
  });
});
