import { queryOptions, skipToken } from "@tanstack/react-query";
import type { components } from "@vortex/nexus-api-v3";

import type { IExtensionApi } from "@/types/IExtensionContext";

import { createVortexNexusV3Client } from "../../nexusV3Client";

/** A mod's details, as the v3 API returns them. */
export type Mod = components["schemas"]["Mod"];

/** One of a mod's images in each size, as the v3 API returns it. */
export type ModImage = components["schemas"]["ModImage"];

/** The keys of the mod queries. */
export const modKeys = {
  /** Every mod. */
  all: ["nexus", "mods", "detail"] as const,
  /** One mod, by its composite mod UID; none while it's skipped. */
  mod: (id: string | undefined) => [...modKeys.all, id] as const,
};

/** A mod's details from the v3 API, by its composite mod UID, or nothing for `skipToken`. */
export const modQuery = (api: IExtensionApi, id: string | typeof skipToken) =>
  queryOptions({
    queryKey: modKeys.mod(id === skipToken ? undefined : id),
    queryFn: id === skipToken ? skipToken : () => createVortexNexusV3Client(api).getModById(id),
  });
