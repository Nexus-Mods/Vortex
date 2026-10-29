import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import useLocalModsSearch from "./LocalModsSearch";

const { mockActiveGameId, mockUseSelector, state } = vi.hoisted(() => ({
  mockActiveGameId: vi.fn<() => string>(),
  mockUseSelector: vi.fn((selector: (s: unknown) => unknown) => selector(state)),
  state: { persistent: { mods: {} } },
}));

vi.mock("@/util/selectors", () => ({ activeGameId: mockActiveGameId }));

vi.mock("react-redux", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useSelector: mockUseSelector,
}));

const mod = (id: string, attributes: Record<string, unknown>) => ({ id, attributes });

describe("LocalModsSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveGameId.mockReturnValue("skyrimse");
    state.persistent.mods = {
      skyrimse: {
        a: mod("a", {
          modName: "SkyUI",
          installTime: "2024-01-01",
          source: "nexus",
        }),
        b: mod("b", {
          name: "Unofficial Patch",
          installTime: "2024-06-01",
          source: "nexus",
        }),
        c: mod("c", {
          fileName: "skyui_se_5_2.zip",
          installTime: "2024-03-01",
          source: "nexus",
        }),
      },
    };
  });

  it("returns nothing for an empty query", async () => {
    const { result } = renderHook(() => useLocalModsSearch(""));

    await waitFor(() => expect(result.current.results).toEqual([]));
  });

  it("matches on any of the mod's name attributes", async () => {
    const { result } = renderHook(() => useLocalModsSearch("skyui"));

    // "SkyUI" by modName, "skyui_se_5_2.zip" by fileName.
    await waitFor(() => expect(result.current.results).toHaveLength(2));
    expect(result.current.results.map((m) => m.id).sort()).toEqual(["a", "c"]);
  });

  it("ignores case", async () => {
    const { result } = renderHook(() => useLocalModsSearch("UNOFFICIAL"));

    await waitFor(() => expect(result.current.results.map((m) => m.id)).toEqual(["b"]));
  });

  it("returns nothing when nothing matches", async () => {
    const { result } = renderHook(() => useLocalModsSearch("nothing-matches-this"));

    await waitFor(() => expect(result.current.results).toEqual([]));
  });

  it("returns the most recently installed first", async () => {
    const { result } = renderHook(() => useLocalModsSearch("s"));

    await waitFor(() => expect(result.current.results.length).toBeGreaterThan(1));
    expect(result.current.results.map((m) => m.id)).toEqual(["c", "a"]);
  });

  it("returns nothing when the active game has no mods", async () => {
    mockActiveGameId.mockReturnValue("fallout4");

    const { result } = renderHook(() => useLocalModsSearch("skyui"));

    await waitFor(() => expect(result.current.results).toEqual([]));
  });
});
