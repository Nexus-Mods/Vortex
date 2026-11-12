import { GameDomain } from "@vortex/shared";
import React from "react";
import { useTranslation } from "react-i18next";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { nexusModReportUrl } from "@/extensions/nexus_integration/util/nexus_urls/nexusUrls";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { Dropdown } from "@/ui/components/dropdown/Dropdown";
import { DropdownButton } from "@/ui/components/dropdown/DropdownButton";
import { DropdownItem } from "@/ui/components/dropdown/DropdownItem";
import { DropdownItems } from "@/ui/components/dropdown/DropdownItems";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";

import { useBrowseModsTracker } from "../../../../hooks/browse_mods_tracking/BrowseModsTracking.context";

/** How long its toast shows: up to 5s is shown as a toast, longer goes to notifications. */
const TOAST_MS = 3000;

interface IModMenuProps {
  api: IExtensionApi;
  /** The mod the menu acts on. */
  mod: ModSummary;
  /** The mod's page on Nexus Mods, which Copy mod link copies. */
  modPageUrl: string;
}

/**
 * The details' … menu of the mod's secondary actions: copying a link to its page, saying so in a
 * toast, and opening its page to report it, which the site opens its report dialog for. Counts
 * each.
 */
export const ModMenu = ({ api, mod, modPageUrl }: IModMenuProps) => {
  const { t } = useTranslation();
  const tracker = useBrowseModsTracker();
  const domain = GameDomain(mod.game.domain_name);

  return (
    <Dropdown>
      <Tooltip content={t("More options")}>
        <DropdownButton
          appearance="moderate"
          aria-label={t("More options")}
          brand="neutral"
          data-testid="mod-menu"
          leftIcon="more_horiz"
        />
      </Tooltip>

      <DropdownItems className="w-60">
        <DropdownItem
          data-testid="mod-menu-copy-link"
          leftIcon="link"
          onClick={async () => {
            try {
              await window.api.clipboard.writeText(modPageUrl);
            } catch (err) {
              api.showErrorNotification?.(t("Couldn't copy the mod link"), err, {
                allowReport: false,
              });
              return;
            }
            tracker.trackModLinkCopied({ mod_uid: mod.id });
            api.sendNotification?.({
              id: "browse-mods-mod-link-copied",
              type: "success",
              message: t("Mod link copied"),
              displayMS: TOAST_MS,
            });
          }}
        >
          {t("Copy mod link")}
        </DropdownItem>

        <DropdownItem
          data-testid="mod-menu-report"
          leftIcon="flag"
          onClick={() => {
            tracker.trackModReportOpened({ mod_uid: mod.id });
            window.api.shell.openUrl(nexusModReportUrl(domain, mod.game_scoped_id));
          }}
        >
          {t("Report mod")}
        </DropdownItem>
      </DropdownItems>
    </Dropdown>
  );
};
