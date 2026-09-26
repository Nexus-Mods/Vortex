/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { IGameMediaPersistentState } from "../reducers/persistent";
import type { IGameMediaSessionState } from "../reducers/session";
import type { GameMediaModTag } from "../util/mediaTypes";
import useGameMediaModTag from "./GameMediaModTagHook";

const { activeGameIdMock, state, store, dispatch, mockUseSelector, mockUseStore } = vi.hoisted(
  () => {
    const dispatch = vi.fn();
    const state: {
      persistent: { game_media: IGameMediaPersistentState };
      session: { game_media: IGameMediaSessionState };
    } = {
      persistent: { game_media: { sources: {}, modTags: {}, disabledSources: {}, flags: {} } },
      session: { game_media: { items: [] as any[] | null } },
    };

    return {
      dispatch,
      state,
      store: { dispatch, getState: () => state },
      activeGameIdMock: vi.fn((): string | undefined => "game-1"),
      mockUseSelector: vi.fn((selector: (s: unknown) => unknown) => selector(state)),
      mockUseStore: vi.fn(),
    };
  },
);

vi.mock("@/util/selectors", () => ({
  activeGameId: activeGameIdMock,
}));

vi.mock("@/extensions/nexus_integration/util/convertGameId", () => ({
  nexusGameId: (game: any) => (game.id === "skyrimse" ? "skyrimspecialedition" : game.id),
}));

vi.mock("@/extensions/gamemode_management/util/getGame", () => ({
  getGame: (id: string) => ({ id, name: id }),
}));

vi.mock("react-redux", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useSelector: mockUseSelector,
  useStore: mockUseStore.mockReturnValue(store),
}));

const fakeContainer = (rect: Partial<DOMRect>) =>
  ({
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 100, ...rect }),
  }) as HTMLDivElement;

const clickAt = (x: number, y: number) => ({ clientX: x, clientY: y }) as React.MouseEvent;

const seedTags = (tagIds: string[], gameId: string, itemId: string) => {
  const tags: GameMediaModTag[] = tagIds.map((id) => ({
    id,
    name: "Example",
    x: 0,
    y: 0,
    createdAt: new Date().toISOString(),
  }));
  const byGame = (state.persistent.game_media.modTags[gameId] ??= {});
  byGame[itemId] = [...(byGame[itemId] ?? []), ...tags];
};

const render = (mediaId: string = "testMedia") =>
  renderHook(({ mediaId }) => useGameMediaModTag(mediaId), { initialProps: { mediaId } });

describe("GameMediaModTagHook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeGameIdMock.mockReturnValue("game-1");
    mockUseSelector.mockImplementation((selector: (s: unknown) => unknown) => selector(state));
    mockUseStore.mockReturnValue(store);
    state.persistent.game_media.modTags = {};
    seedTags(["a", "b", "c"], "game-1", "item-1");
    seedTags(["d", "e", "f"], "game-2", "item-2");
  });

  it("returns the correct gameId and domainName", () => {
    activeGameIdMock.mockReturnValue("skyrimse");
    const hook = render();
    expect(hook.result.current.gameId).toBe("skyrimse");
    expect(hook.result.current.domainName).toBe("skyrimspecialedition");
  });

  it("updates domainName when gameId changes", async () => {
    const hook = render();
    activeGameIdMock.mockReturnValue("fallout4");
    hook.rerender({ mediaId: "testMedia" });
    expect(hook.result.current.gameId).toBe("fallout4");
    await waitFor(() => expect(hook.result.current.domainName).toBe("fallout4"));
  });

  it("returns the correct tags from the store", () => {
    activeGameIdMock.mockReturnValue("game-1");
    const hook = render("item-1");

    const { tags, gameId } = hook.result.current;

    expect(gameId).toBe("game-1");
    expect(tags.length).toBe(3);
    expect(tags.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("returns a consistent empty array to prevent rerenders", async () => {
    const hook = render("invalid");
    const empty = hook.result.current.tags;
    expect(empty.length).toBe(0);

    hook.rerender({ mediaId: "invalid" });

    expect(hook.result.current.tags).toBe(empty);
  });

  it("dispatches setGameMediaModTags correctly", () => {
    const hook = render();
    const setTags = hook.result.current.setTags;
    const newTag = [{ id: "zz", name: "zz", x: 0, y: 0, createdAt: new Date().toString() }];
    act(() => setTags(newTag));
    expect(dispatch).toHaveBeenCalledWith({
      error: false,
      payload: {
        gameId: "game-1",
        mediaId: "testMedia",
        tags: newTag,
      },
      type: "SET_GAME_MEDIA_MOD_TAGS",
    });
  });

  it("ignores clicks while not adding a tag", () => {
    const { result } = render();

    result.current.containerRef.current = fakeContainer({});
    act(() => result.current.onImageClick(clickAt(100, 50)));

    expect(result.current.isAddingTag).toBe(false);
    expect(result.current.pendingCoords).toBeNull();
  });

  it("ignores clicks when the container is not mounted", () => {
    const { result } = render();

    act(() => result.current.setIsAddingTag(true));
    expect(result.current.containerRef.current).toBeNull();
    act(() => result.current.onImageClick(clickAt(100, 50)));

    expect(result.current.pendingCoords).toBeNull();
  });

  it("converts a click into normalised coordinates", () => {
    const { result } = render();

    act(() => result.current.setIsAddingTag(true));
    result.current.containerRef.current = fakeContainer({});
    act(() => result.current.onImageClick(clickAt(100, 50)));

    expect(result.current.pendingCoords).toEqual({ x: 0.5, y: 0.5 });
  });

  it("clamps clicks outside the container", () => {
    const { result } = render();

    act(() => result.current.setIsAddingTag(true));
    result.current.containerRef.current = fakeContainer({});

    act(() => result.current.onImageClick(clickAt(-40, -40)));
    expect(result.current.pendingCoords).toEqual({ x: 0, y: 0 });

    act(() => result.current.onImageClick(clickAt(999, 999)));
    expect(result.current.pendingCoords).toEqual({ x: 1, y: 1 });
  });

  it("ignores clicks before the container has been laid out", () => {
    const { result } = render();

    act(() => result.current.setIsAddingTag(true));
    result.current.containerRef.current = fakeContainer({ width: 0, height: 0 });
    act(() => result.current.onImageClick(clickAt(10, 10)));

    expect(result.current.pendingCoords).toBeNull();
  });
});
