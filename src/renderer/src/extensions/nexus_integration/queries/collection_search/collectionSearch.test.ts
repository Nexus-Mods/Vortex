import type { ICollectionSearchOptions } from "@nexusmods/nexus-api";
import { QueryClient, skipToken } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { queryClient } from "@/util/queryClient";

import { collectionSearchKeys, collectionSearchQuery } from "./collectionSearch.query";

const options: ICollectionSearchOptions = { gameId: "skyrimspecialedition", count: 20, offset: 0 };

const apiSearching = (result: unknown) => {
  const nexusSearchCollections = vi.fn().mockResolvedValue(result);
  return {
    api: { ext: { nexusSearchCollections } } as unknown as IExtensionApi,
    nexusSearchCollections,
  };
};

const client = () => new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });

describe("collectionSearchQuery", () => {
  it("asks for the search as given, and returns its collections and total", async () => {
    const { api, nexusSearchCollections } = apiSearching({ nodes: [{ id: 1 }], totalCount: 45 });

    const result = await client().query(collectionSearchQuery(api, options));

    expect(nexusSearchCollections).toHaveBeenCalledWith(options);
    expect(result).toEqual({ nodes: [{ id: 1 }], totalCount: 45 });
  });

  it("returns no collections and no total for a result without them", async () => {
    const { api } = apiSearching({});

    const result = await client().query(collectionSearchQuery(api, options));

    expect(result).toEqual({ nodes: [], totalCount: 0 });
  });

  it("keys each search by its options, under every search's key", () => {
    const { api } = apiSearching({});

    expect(collectionSearchQuery(api, options).queryKey).toEqual([
      ...collectionSearchKeys.all,
      options,
    ]);
  });

  it("asks for nothing when it's skipped", () => {
    const { api } = apiSearching({});

    expect(collectionSearchQuery(api, skipToken).queryFn).toBe(skipToken);
  });
});
