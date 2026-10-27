import React from "react";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { NoResults } from "@/ui/components/no_results/NoResults";

import { collectionT } from "../../hooks/use_collection_search/useCollectionSearch.hook";

interface IModsComingSoonProps {
  api: IExtensionApi;
  /** The game's Nexus Mods domain, for its mods on the website. */
  gameDomainName: string;
}

/** The Mods tab while `laz-vortex-browse-mods` is off: mods are coming, and the website has them. */
export const ModsComingSoon = ({ api, gameDomainName }: IModsComingSoonProps) => {
  const t = collectionT(api);

  return (
    <NoResults
      className="py-16"
      icon="schedule"
      message={t("collection:browse.modsComingSoon.description")}
      title={t("collection:browse.modsComingSoon.title")}
    >
      <Button
        appearance="moderate"
        brand="neutral"
        leftIcon="open_in_new"
        onClick={() =>
          window.api.shell.openUrl(`https://www.nexusmods.com/games/${gameDomainName}/mods`)
        }
      >
        {t("collection:browse.modsComingSoon.openWebsite")}
      </Button>
    </NoResults>
  );
};
