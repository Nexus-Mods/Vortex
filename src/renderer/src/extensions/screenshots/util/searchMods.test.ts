/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

import searchMods from "./searchMods";

const gameDomain = "skyrim";
const token = "exampleUserToken";
const signal = vi.fn();

const { mockFetch } = vi.hoisted(() => {
  const mockFetch = vi
    .fn(async (_url: string, _options: any): Promise<Response> => ({}) as any)
    .mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { mods: { nodes: [] } } }),
      status: 200,
      statusText: "Success",
    } as any);
  return { mockFetch };
});

global.fetch = mockFetch;

describe("searchMods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds to correct filter based on the passed user preference", async () => {
    await searchMods("skyui", gameDomain, undefined, true, signal as any);

    const adultOnBody = JSON.parse(mockFetch.mock.calls[0][1].body);

    expect(adultOnBody.variables.filter.adult).toBeUndefined();

    await searchMods("skyui", gameDomain, undefined, false, signal as any);

    const adultOffBody = JSON.parse(mockFetch.mock.calls[1][1].body);

    expect(adultOffBody.variables.filter.adult.value).toBe("false");
  });

  it("sends the user's token in the Authorization header", async () => {
    await searchMods("skyui", gameDomain, token, true, signal as any);
    const headers = mockFetch.mock.calls[0][1].headers;

    expect(headers["Authorization"]).toBe(`Bearer ${token}`);
  });

  it("throws an error for an expired token", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
    } as any);

    try {
      await searchMods("skse", gameDomain, token, true, signal as any);
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
    } as any);

    try {
      await searchMods("skse", gameDomain, token, true, signal as any);
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
    } as any);
    await searchMods("skse", gameDomain, token, true, signal as any);

    expect(mockFetch.mock.calls[0][1].signal).toBe(signal);
  });
});
