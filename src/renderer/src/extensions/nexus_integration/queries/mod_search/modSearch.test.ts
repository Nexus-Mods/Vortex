import { QueryClient, skipToken } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ searchMods: vi.fn() }));

vi.mock("../../nexusV3Client", () => ({
  createVortexNexusV3Client: () => ({ searchMods: mocks.searchMods }),
}));

import type { IExtensionApi } from "@/types/IExtensionContext";
import { queryClient } from "@/util/queryClient";

import { type ModsSearchRequest, modSearchKeys, modSearchQuery } from "./modSearch.query";

const api = {} as IExtensionApi;

const search: ModsSearchRequest = {
  filters: { games: ["skyrimspecialedition"] },
  sort: { field: "trending", direction: "desc" },
  pagination: { page: 1, page_size: 20 },
};

const client = () => new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });

describe("modSearchQuery", () => {
  it("asks for the search as given, and returns the API's result", async () => {
    const response = { mods: [{ id: "1" }], meta: { page: 1, page_size: 20, total_count: 45 } };
    mocks.searchMods.mockResolvedValue(response);

    const result = await client().query(modSearchQuery(api, search));

    expect(mocks.searchMods).toHaveBeenCalledWith(search);
    expect(result).toEqual(response);
  });

  it("keys each search by its request, under every search's key", () => {
    expect(modSearchQuery(api, search).queryKey).toEqual([...modSearchKeys.all, search]);
  });

  it("asks for nothing when it's skipped", () => {
    expect(modSearchQuery(api, skipToken).queryFn).toBe(skipToken);
  });
});
