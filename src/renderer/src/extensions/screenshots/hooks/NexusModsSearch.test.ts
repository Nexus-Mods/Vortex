/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/require-await */
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import type { IModResult } from "../util/searchMods";
import useNexusModsSearch from "./NexusModsSearch";

const { mockSearchMods, mockGetAccessToken, state, mockApi } = vi.hoisted(() => {
  const mockSearchMods = vi
    .fn(
      async (
        _query: string,
        _gameDomain: string,
        _token: string | undefined,
        _showAdult: boolean,
        _signal: AbortController["signal"],
      ): Promise<IModResult[]> => [],
    )
    .mockResolvedValue([]);

  const mockGetAccessToken = vi
    .fn(async (_api: any): Promise<string | undefined> => undefined)
    .mockResolvedValue("tokenFromState");

  const state = {
    persistent: {
      nexus: {
        userInfo: {
          adult: true,
        },
      },
    },
  };

  const mockApi = {};

  return { mockSearchMods, mockGetAccessToken, state, mockApi };
});

vi.mock("react-redux", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useSelector: (selector: (s: unknown) => unknown) => selector(state),
}));

vi.mock("../util/searchMods", () => ({
  default: mockSearchMods,
}));

vi.mock("@/extensions/nexus_integration/util/oauthSession", () => ({
  getAccessToken: mockGetAccessToken,
}));

vi.mock("../../../util/selectors", () => ({
  activeGameId: vi.fn((): string | undefined => "skyrim"),
}));

vi.mock("../../../util/api", () => ({
  getGame: vi.fn((_gameId: string) => ({ name: "Skyrim" })),
  nexusGameId: vi.fn((_game: any, _fallback?: string) => "skyrim"),
}));

const render = (query = "", api: any = {}, options: any = undefined) =>
  renderHook(({ query, api, options }) => useNexusModsSearch(query, api, options), {
    initialProps: { query, api, options },
  });

const deferred = () => {
  let resolve!: (value: IModResult[]) => void;
  const promise = new Promise<IModResult[]>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe("NexusModsSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchMods.mockResolvedValue([]);
    mockGetAccessToken.mockResolvedValue("tokenFromState");
    state.persistent.nexus.userInfo.adult = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces rapid inputs", async () => {
    vi.useFakeTimers();

    const options = { debounceDelayMs: 1000 };

    const hook = render("", {}, options);

    hook.rerender({ query: "s", api: mockApi, options });
    hook.rerender({ query: "sk", api: mockApi, options });
    hook.rerender({ query: "sky", api: mockApi, options });

    expect(mockSearchMods).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockSearchMods).toHaveBeenCalledOnce();
  });

  it("doesn't search an empty query", () => {
    const hook = render("");
    hook.rerender({ query: "", api: mockApi, options: {} });
    hook.rerender({ query: "", api: mockApi, options: {} });

    expect(mockSearchMods).not.toHaveBeenCalled();
  });

  it("passes a token when tryToUseLogin is passed", async () => {
    const hook = render("skyui", mockApi, { tryToUseLogin: true });

    await waitFor(() => expect(mockSearchMods).toHaveBeenCalledTimes(1));

    expect(mockSearchMods).toHaveBeenCalledWith(
      "skyui",
      "skyrim",
      "tokenFromState",
      true,
      expect.anything(),
    );

    hook.rerender({ query: "skse", api: mockApi, options: {} });

    await waitFor(() => expect(mockSearchMods).toHaveBeenCalledTimes(3));

    expect(mockSearchMods).toHaveBeenLastCalledWith(
      "skse",
      "skyrim",
      undefined,
      false,
      expect.anything(),
    );
  });

  it("ignores stale responses", async () => {
    const first = deferred();
    const second = deferred();
    mockSearchMods.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const options = { debounceDelayMs: 0 };
    const hook = render("sky", mockApi, options);
    await waitFor(() => expect(mockSearchMods).toHaveBeenCalledTimes(1));

    hook.rerender({ query: "skyui", api: mockApi, options });
    await waitFor(() => expect(mockSearchMods).toHaveBeenCalledTimes(2));

    const latest = [{ uid: "2" } as IModResult];
    await act(async () => second.resolve(latest));
    await act(async () => first.resolve([{ uid: "1" } as IModResult]));

    expect(hook.result.current.results).toEqual(latest);
  });

  it("aborts in flight requests on unmount", async () => {
    const hook = render("skyui", mockApi, { debouceDelayMs: 0 });
    await waitFor(() => expect(mockSearchMods).toHaveBeenCalledOnce());

    const signal = mockSearchMods.mock.lastCall[4];
    expect(signal.aborted).toBe(false);

    hook.unmount();

    expect(signal.aborted).toBe(true);
  });

  it("passes the adult flag through", async () => {
    state.persistent.nexus.userInfo.adult = true;

    const hook = render("skyui", mockApi, { tryToUseLogin: true, debounceDelayMs: 0 });

    await waitFor(() => expect(mockSearchMods).toHaveBeenCalledOnce());

    expect(mockSearchMods).toHaveBeenCalledWith(
      "skyui",
      "skyrim",
      "tokenFromState",
      true,
      expect.anything(),
    );
    state.persistent.nexus.userInfo.adult = false;

    hook.rerender({
      query: "skyui",
      api: mockApi,
      options: { tryToUseLogin: true, debounceDelayMs: 0 },
    });

    await waitFor(() => expect(mockSearchMods).toHaveBeenCalledTimes(2));

    expect(mockSearchMods).toHaveBeenLastCalledWith(
      "skyui",
      "skyrim",
      "tokenFromState",
      false,
      expect.anything(),
    );
  });

  it("surfaces an error when the request fails", async () => {
    mockSearchMods.mockImplementation(() => {
      throw new Error("Failed!");
    });

    const hook = render("skyui");

    await waitFor(() => expect(mockSearchMods).toHaveBeenCalledOnce());

    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(hook.result.current.error?.message).toBe("Failed!");
  });
});
