import type { ICollection, ICollectionSearchOptions } from "@nexusmods/nexus-api";
import { queryOptions, skipToken } from "@tanstack/react-query";

import type { IExtensionApi } from "@/types/IExtensionContext";

/** The keys of the collection search queries. */
export const collectionSearchKeys = {
  /** Every collection search, which refreshing invalidates. */
  all: ["nexus", "collections", "search"] as const,
  /** One search, by its options; none while it's skipped. */
  search: (options: ICollectionSearchOptions | undefined) =>
    [...collectionSearchKeys.all, options] as const,
};

/**
 * A search of Nexus Mods' collections, as the options ask, or nothing for `skipToken`. Its nodes
 * are typed whole, as the search's GraphQL query selects every field.
 */
export const collectionSearchQuery = (
  api: IExtensionApi,
  options: ICollectionSearchOptions | typeof skipToken,
) =>
  queryOptions({
    queryKey: collectionSearchKeys.search(options === skipToken ? undefined : options),
    queryFn:
      options === skipToken
        ? skipToken
        : async (): Promise<{ nodes: ICollection[]; totalCount: number }> => {
            const result = await api.ext.nexusSearchCollections(options);
            return {
              nodes: (result.nodes ?? []) as ICollection[],
              totalCount: result.totalCount ?? 0,
            };
          },
  });
