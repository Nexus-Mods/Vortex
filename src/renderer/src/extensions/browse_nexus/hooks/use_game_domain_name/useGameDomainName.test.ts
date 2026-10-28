import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  gameId: undefined as string | undefined,
  game: undefined as { id: string; details?: { nexusPageId?: string } } | undefined,
}));

vi.mock("react-redux", () => ({
  useSelector: (selector: (state: unknown) => unknown) => selector({}),
}));

vi.mock("@/util/selectors", () => ({
  activeGameId: () => mocks.gameId,
}));

vi.mock("@/extensions/gamemode_management/util/getGame", () => ({
  getGame: () => mocks.game,
}));

import { useGameDomainName } from "./useGameDomainName.hook";

describe("useGameDomainName", () => {
  beforeEach(() => {
    mocks.gameId = undefined;
    mocks.game = undefined;
  });

  it("has none outside a game", () => {
    const { result } = renderHook(() => useGameDomainName());

    expect(result.current).toBeUndefined();
  });

  it("uses the Nexus page id a game's extension gives", () => {
    mocks.gameId = "skyrimse";
    mocks.game = { id: "skyrimse", details: { nexusPageId: "skyrimspecialedition" } };

    const { result } = renderHook(() => useGameDomainName());

    expect(result.current).toBe("skyrimspecialedition");
  });

  it("falls back to the game's id where its domain is the same", () => {
    mocks.gameId = "stardewvalley";
    mocks.game = { id: "stardewvalley" };

    const { result } = renderHook(() => useGameDomainName());

    expect(result.current).toBe("stardewvalley");
  });

  it("maps a game whose domain differs from its id, with no extension to say so", () => {
    mocks.gameId = "falloutnv";

    const { result } = renderHook(() => useGameDomainName());

    expect(result.current).toBe("newvegas");
  });
});
