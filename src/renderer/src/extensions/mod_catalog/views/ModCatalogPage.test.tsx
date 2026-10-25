import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { Provider } from "react-redux";
import type { Store } from "redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";

import { clearCatalogCache } from "../useCatalogPages";
import ModCatalogPage from "./ModCatalogPage";

vi.mock("@/extensions/gamemode_management/util/getGame", () => ({
  getGame: () => ({ id: "cyberpunk2077" }),
}));
vi.mock("@/extensions/nexus_integration/util/convertGameId", () => ({
  nexusGameId: () => "cyberpunk2077",
}));
vi.mock("@/views/MainPage", () => {
  const MainPage = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  MainPage.Body = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(
    ({ children }, ref) => <div ref={ref}>{children}</div>,
  );
  return { default: MainPage };
});

function rawMod(modId: number, extra: Record<string, unknown> = {}) {
  return {
    modId,
    uid: `uid-${modId}`,
    name: `Mod ${modId}`,
    summary: "summary",
    author: "author",
    version: "1.0",
    downloads: 10,
    endorsements: 2,
    updatedAt: "2026-10-01T00:00:00Z",
    adultContent: false,
    modCategory: { name: "Gameplay" },
    ...extra,
  };
}

function makeState(overrides: { loggedIn?: boolean; installed?: Record<string, unknown> } = {}) {
  return {
    settings: { modCatalog: { showAdult: false } },
    persistent: {
      mods: { cyberpunk2077: overrides.installed ?? {} },
      categories: {},
      profiles: { p1: { id: "p1", gameId: "cyberpunk2077" } },
    },
    settings_profiles_dummy: undefined,
    confidential: {
      account: { nexus: overrides.loggedIn ? { APIKey: "key" } : {} },
    },
  } as unknown as IState;
}

function setup(
  options: { loggedIn?: boolean; installed?: Record<string, unknown>; total?: number } = {},
) {
  const state = makeState(options);
  (state as unknown as { settings: Record<string, unknown> }).settings.profiles = {
    activeProfileId: "p1",
  };
  const store = {
    getState: () => state,
    subscribe: () => () => undefined,
    dispatch: vi.fn(),
  } as unknown as Store<IState>;

  const total = options.total ?? 2;
  const queryGraph = vi.fn(
    async (_query: string, variables: { offset: number; filter?: unknown }) => ({
      mods: {
        totalCount: total,
        nodes: variables.offset === 0 ? [rawMod(1), rawMod(2)] : [rawMod(3)],
      },
    }),
  );
  const nexusGetModFiles = vi.fn(async () => [
    {
      file_id: 11,
      category_name: "MAIN",
      is_primary: true,
      file_name: "a.zip",
      uploaded_timestamp: 1,
    },
  ]);
  const nexusDownload = vi.fn(async () => "dl-id");
  const nexusGetModInfo = vi.fn(async () => ({ description: "[b]Full[/b] description" }));
  const nexusGetModRequirements = vi.fn(async () => ({
    "uid-1": {
      nexusRequirements: {
        nodes: [{ id: "r1", modName: "Codeware", url: "https://example.invalid/r1" }],
      },
    },
  }));
  const api = {
    ext: {
      nexusQueryGraph: queryGraph,
      nexusGetModFiles,
      nexusDownload,
      nexusGetModInfo,
      nexusGetModRequirements,
    },
    showErrorNotification: vi.fn(),
  } as unknown as IExtensionApi;

  render(
    <Provider store={store}>
      <ModCatalogPage api={api} />
    </Provider>,
  );
  return { queryGraph, nexusGetModFiles, nexusDownload };
}

describe("ModCatalogPage", () => {
  beforeEach(() => clearCatalogCache());
  afterEach(() => vi.useRealTimers());

  it("lists the mods of the active game, without adult mods", async () => {
    const { queryGraph } = setup();
    expect(await screen.findByText("Mod 1")).toBeInTheDocument();
    expect(screen.getByText("Mod 2")).toBeInTheDocument();
    const variables = queryGraph.mock.calls[0][1] as unknown as { filter: Record<string, unknown> };
    expect(variables.filter).toEqual({
      gameDomainName: [{ value: "cyberpunk2077", op: "EQUALS" }],
      adultContent: [{ value: false, op: "EQUALS" }],
    });
  });

  it("waits for typing to pause before searching", async () => {
    const { queryGraph } = setup();
    await screen.findByText("Mod 1");
    vi.useFakeTimers();
    const input = screen.getByPlaceholderText("Search mods by name");
    fireEvent.change(input, { target: { value: "re" } });
    fireEvent.change(input, { target: { value: "red" } });
    fireEvent.change(input, { target: { value: "redscript" } });
    expect(queryGraph).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    vi.useRealTimers();
    await waitFor(() => expect(queryGraph).toHaveBeenCalledTimes(2));
    const variables = queryGraph.mock.calls[1][1] as unknown as { filter: { name?: unknown } };
    expect(variables.filter.name).toEqual([{ value: "redscript", op: "WILDCARD" }]);
  });

  it("loads the next page on request", async () => {
    const { queryGraph } = setup({ total: 3 });
    await screen.findByText("Mod 1");
    fireEvent.click(screen.getByText("Load more"));
    expect(await screen.findByText("Mod 3")).toBeInTheDocument();
    expect((queryGraph.mock.calls[1][1] as unknown as { offset: number }).offset).toBe(2);
    expect(screen.queryByText("Load more")).not.toBeInTheDocument();
  });

  it("marks installed mods", async () => {
    setup({
      installed: {
        a: { id: "a", attributes: { source: "nexus", modId: 1, version: "1.0" } },
        b: { id: "b", attributes: { source: "nexus", modId: 2, version: "0.9" } },
      },
    });
    await screen.findByText("Mod 1");
    const labels = screen.getAllByTestId("catalog-install-state").map((el) => el.textContent);
    expect(labels).toEqual(["Installed", "Update available"]);
  });

  it("installs the primary file through the regular Nexus download", async () => {
    const { nexusGetModFiles, nexusDownload } = setup({ loggedIn: true });
    await screen.findByText("Mod 1");
    fireEvent.click(screen.getAllByText("Install")[0]);
    await waitFor(() =>
      expect(nexusDownload).toHaveBeenCalledWith("cyberpunk2077", 1, 11, "a.zip", true),
    );
    expect(nexusGetModFiles).toHaveBeenCalledWith("cyberpunk2077", 1);
  });

  it("shows the mod page with files and requirements, and installs the chosen file", async () => {
    const { nexusDownload } = setup({ loggedIn: true });
    await screen.findByText("Mod 1");
    fireEvent.click(screen.getAllByText("Details")[0]);
    expect(await screen.findByText("Back to catalog")).toBeInTheDocument();
    expect(await screen.findByText("Codeware")).toBeInTheDocument();
    expect(await screen.findByText("Full")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Install"));
    await waitFor(() =>
      expect(nexusDownload).toHaveBeenCalledWith("cyberpunk2077", 1, 11, "a.zip", true),
    );
    fireEvent.click(screen.getByText("Back to catalog"));
    expect(await screen.findByText("Mod 2")).toBeInTheDocument();
  });

  it("asks to log in before installing", async () => {
    setup({ loggedIn: false });
    await screen.findByText("Mod 1");
    const buttons = screen.getAllByText("Log in to install");
    expect(buttons.length).toBe(2);
  });
});
