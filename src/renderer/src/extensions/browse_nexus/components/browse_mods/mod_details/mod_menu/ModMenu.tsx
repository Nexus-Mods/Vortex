import { MenuButton } from "@headlessui/react";
import { GameDomain } from "@vortex/shared";
import React from "react";
import { useTranslation } from "react-i18next";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import {
  nexusModPageUrl,
  nexusModReportUrl,
} from "@/extensions/nexus_integration/util/nexus_urls/nexusUrls";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { Dropdown } from "@/ui/components/dropdown/Dropdown";
import { DropdownItem } from "@/ui/components/dropdown/DropdownItem";
import { DropdownItems } from "@/ui/components/dropdown/DropdownItems";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { calcDuration } from "@/util/message";

import { useBrowseModsTracker } from "../../../../hooks/browse_mods_tracking/BrowseModsTracking.context";

interface IModMenuProps {
  api: IExtensionApi;
  /** The mod the menu acts on. */
  mod: ModSummary;
}

/**
 * The details' … menu of the mod's secondary actions: copying a link to its page, saying so in a
 * toast, and opening its page to report it, which the site opens its report dialog for. Counts
 * each.
 */
export const ModMenu = ({ api, mod }: IModMenuProps) => {
  const { t } = useTranslation();
  const tracker = useBrowseModsTracker();
  const domain = GameDomain(mod.game.domain_name);

  return (
    <Dropdown>
      <Tooltip content={t("More options")}>
        <MenuButton
          appearance="moderate"
          aria-label={t("More options")}
          as={Button}
          brand="neutral"
          data-testid="mod-menu"
          leftIcon="more_horiz"
        />
      </Tooltip>

      <DropdownItems className="w-60">
        <DropdownItem
          data-testid="mod-menu-copy-link"
          leftIcon="link"
          onClick={() => {
            window.api.clipboard
              .writeText(nexusModPageUrl(domain, mod.game_scoped_id))
              .then(() => {
                const message = t("Mod link copied");
                tracker.trackModLinkCopied({ mod_uid: mod.id });
                api.sendNotification?.({
                  id: "browse-mods-mod-link-copied",
                  type: "success",
                  message,
                  displayMS: calcDuration(message.length),
                });
              })
              .catch((err: unknown) =>
                api.showErrorNotification?.(t("Couldn't copy the mod link"), err, {
                  allowReport: false,
                }),
              );
          }}
        >
          {t("Copy mod link")}
        </DropdownItem>

        <DropdownItem
          data-testid="mod-menu-report"
          leftIcon="flag"
          onClick={() => {
            tracker.trackReportOpened({ mod_uid: mod.id });
            window.api.shell.openUrl(nexusModReportUrl(domain, mod.game_scoped_id));
          }}
        >
          {t("Report mod")}
        </DropdownItem>
      </DropdownItems>
    </Dropdown>
  );
};
