import React from "react";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { NoResults } from "@/ui/components/no_results/NoResults";

import { useGameDomainName } from "../../hooks/use_game_domain_name/useGameDomainName.hook";
import { collectionT } from "../../util/collectionT";

interface IModsComingSoonProps {
  api: IExtensionApi;
}

/** The Mods tab while `laz-vortex-browse-mods` is off: mods are coming, and the website has them. */
export const ModsComingSoon = ({ api }: IModsComingSoonProps) => {
  const t = collectionT(api);
  const gameDomainName = useGameDomainName();

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
