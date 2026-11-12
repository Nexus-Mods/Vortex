import { queryOptions } from "@tanstack/react-query";
import { GameDomain } from "@vortex/shared";

import { mainFilesOf } from "@/extensions/browse_nexus/util/main_files/mainFiles";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";

/** Which mod's Main files to fetch. */
interface IMainFilesQueryArgs {
  /** The mod, fetched from its own game's Nexus Mods domain. */
  mod: ModSummary;
}

/** A mod's Main files, fetched from the v1 API only when run with `fetchQuery`. */
export const mainFilesQuery = (api: IExtensionApi, { mod }: IMainFilesQueryArgs) =>
  queryOptions({
    queryKey: ["browse", "main-files", mod.id] as const,
    queryFn: async () => {
      const fetchModFiles = api.ext.nexusFetchModFiles;
      if (!fetchModFiles) {
        throw new Error("Nexus Mods integration isn't available");
      }
      const domain = GameDomain(mod.game.domain_name);
      return mainFilesOf(await fetchModFiles(domain, Number(mod.game_scoped_id)));
    },
  });
