import { queryOptions } from "@tanstack/react-query";
import { NexusGameDomain } from "@vortex/shared";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";

/** Which mod's files to fetch. */
interface IModFilesQueryArgs {
  /** The mod, fetched from its own game's Nexus Mods domain. */
  mod: ModSummary;
}

/** Query keys for mods' file lists. */
export const modFilesKeys = {
  /** Every mod's files. */
  all: ["nexus", "mods", "files"] as const,
  /** One mod's files, by its composite mod UID. */
  files: (id: string) => [...modFilesKeys.all, id] as const,
};

/** All of a mod's files, fetched from the v1 API only when run with `fetchQuery`. */
export const modFilesQuery = (api: IExtensionApi, { mod }: IModFilesQueryArgs) =>
  queryOptions({
    queryKey: modFilesKeys.files(mod.id),
    queryFn: async () => {
      const fetchModFiles = api.ext.nexusFetchModFiles;
      if (!fetchModFiles) {
        throw new Error("Nexus Mods integration isn't available");
      }
      const domain = NexusGameDomain(mod.game.domain_name);
      return fetchModFiles(domain, Number(mod.game_scoped_id));
    },
  });
