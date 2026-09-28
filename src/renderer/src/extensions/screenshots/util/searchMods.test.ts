import { beforeEach, describe, expect, it, vi } from "vitest";

import searchMods from "./searchMods";

const gameDomain = "skyrim";
const token = "exampleUserToken";
const signal = vi.fn() as unknown as AbortController["signal"];

const { mockFetch } = vi.hoisted(() => {
  const mockFetch = vi
    .fn(
      async (_url: string, _options: RequestInit): Promise<Response> =>
        Promise.resolve({} as Response),
    )
    .mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { mods: { nodes: [] } } }),
      status: 200,
      statusText: "Success",
    } as unknown as Response);
  return { mockFetch };
});

global.fetch = mockFetch;

describe("searchMods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds to correct filter based on the passed user preference", async () => {
    await searchMods("skyui", gameDomain, undefined, true, signal);

    const adultOnBody = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
      variables: { filter: { adult?: { value: boolean } } };
    };

    expect(adultOnBody.variables.filter.adult).toBeUndefined();

    await searchMods("skyui", gameDomain, undefined, false, signal);

    const adultOffBody = JSON.parse(mockFetch.mock.calls[1][1].body as string) as {
      variables: { filter: { adult?: { value: boolean } } };
    };

    expect(adultOffBody.variables.filter.adult.value).toBe(false);
  });

  it("sends the user's token in the Authorization header", async () => {
    await searchMods("skyui", gameDomain, token, true, signal);
    const headers = mockFetch.mock.calls[0][1].headers;

    expect(headers["Authorization"]).toBe(`Bearer ${token}`);
  });

  it("throws an error for an expired token", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
    } as unknown as Response);

    try {
      await searchMods("skse", gameDomain, token, true, signal);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : undefined;
      expect(error).toBe("Nexus Mods token has expired, please log out and back in.");
    }
  });

  it("throws an error when GraphQL errors are returned", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ errors: [] }),
    } as unknown as Response);

    try {
      await searchMods("skse", gameDomain, token, true, signal);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : undefined;
      expect(error).toBe("Mod search failed with GraphQL errors");
    }
  });

  it("passes the AbortSignal through to fetch", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { mods: { nodes: [] } } }),
      status: 200,
      statusText: "Success",
    } as unknown as Response);
    await searchMods("skse", gameDomain, token, true, signal);

    expect(mockFetch.mock.calls[0][1].signal).toBe(signal);
  });
});
