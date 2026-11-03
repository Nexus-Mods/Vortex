import { queryOptions, skipToken } from "@tanstack/react-query";
import type { components } from "@vortex/nexus-api-v3";

import type { IExtensionApi } from "@/types/IExtensionContext";

import { createVortexNexusV3Client } from "../../nexusV3Client";

/** A mod search, as the v3 API takes it. */
export type ModsSearchRequest = components["schemas"]["ModsSearchRequest"];

/** A mod in the search's results. */
export type ModSummary = components["schemas"]["ModSummary"];

/** The keys of the mod search queries. */
export const modSearchKeys = {
  /** Every mod search, which refreshing invalidates. */
  all: ["nexus", "mods", "search"] as const,
  /** One search, by its request; none while it's skipped. */
  search: (search: ModsSearchRequest | undefined) => [...modSearchKeys.all, search] as const,
};

/** A search of Nexus Mods' mods with the v3 API, as the request asks, or nothing for `skipToken`. */
export const modSearchQuery = (api: IExtensionApi, search: ModsSearchRequest | typeof skipToken) =>
  queryOptions({
    queryKey: modSearchKeys.search(search === skipToken ? undefined : search),
    queryFn:
      search === skipToken ? skipToken : () => createVortexNexusV3Client(api).searchMods(search),
  });
