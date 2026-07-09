import { mdiHelpCircleOutline, mdiOpenInNew } from "@mdi/js";
import type { TFunction } from "i18next";
import React from "react";

import { Button } from "@/ui/components/button/Button";
import { NoResults } from "@/ui/components/no_results/NoResults";

interface INoGamesFoundProps {
  className?: string;
  t: TFunction;
}

export const NoGamesFound = ({ className, t }: INoGamesFoundProps) => (
  <NoResults
    className={className}
    iconPath={mdiHelpCircleOutline}
    message={t("It may not be supported yet but adding it yourself may be easier than you think.")}
    title={t("Can't find the game you're looking for?")}
  >
    <Button
      appearance="moderate"
      brand="neutral"
      leftIconPath={mdiOpenInNew}
      size="sm"
      onClick={() =>
        window.api.shell.openUrl(
          "https://github.com/Nexus-Mods/Vortex/wiki/MODDINGWIKI-Developers-General-Creating-a-game-extension",
        )
      }
    >
      {t("Learn how to make an extension")}
    </Button>
  </NoResults>
);
