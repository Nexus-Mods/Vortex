import type { TFunction } from "i18next";
import React from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { TabBar } from "@/ui/components/tabs/TabBar";
import { TabButton } from "@/ui/components/tabs/TabButton";
import { TabPanel } from "@/ui/components/tabs/TabPanel";
import { useTabContext } from "@/ui/components/tabs/Tabs.context";
import { joinClasses } from "@/ui/utils/joinClasses";
import { PageHeader } from "@/views/components/Page/PageHeader";

import { currentGame } from "../../../../gamemode_management/selectors";
import { BrowseCollections } from "../../../components/browse_collections/BrowseCollections";
import { BrowseMods } from "../../../components/browse_mods/BrowseMods";
import { ModsComingSoon } from "../../../components/mods_coming_soon/ModsComingSoon";
import { useCollectionSearch } from "../../../hooks/use_collection_search/useCollectionSearch.hook";
import { useModSearch } from "../../../hooks/use_mod_search/useModSearch.hook";

/** What the page is for, naming the game when there is one. */
const pageSubtitle = (t: TFunction, gameName: string | undefined) => {
  if (!gameName) {
    return t("Discover and install mods.");
  }

  return t("Discover and install mods for {{game}}.", { game: gameName });
};

interface IBrowseSectionsProps {
  api: IExtensionApi;
  /** Whether the mods are browsable, or only say they're coming soon. */
  isModsEnabled: boolean;
  /** Whether the mods are on screen: the page open on their tab. */
  isModsShown: boolean;
  /** Whether Vortex can handle collections for the game, and so gives them a tab. */
  supportsCollections: boolean;
}

/**
 * The open game's mods and collections, under the header with a tab for each, its title marked
 * beta while the mods are open. `BrowsePage` keys it by the game, so a search or page picked for
 * one game starts over in the next, and no game's results show in another's. The mods' views, the
 * open one and the presets' changes are kept across games.
 */
export const BrowseSections = ({
  api,
  isModsEnabled,
  isModsShown,
  supportsCollections,
}: IBrowseSectionsProps) => {
  const { t } = useTranslation();
  const subtitle = pageSubtitle(t, useSelector(currentGame)?.name);
  const collections = useCollectionSearch(api);
  const mods = useModSearch(api, { isEnabled: isModsEnabled });
  const { selectedTab } = useTabContext();
  const isModsTab = isModsEnabled && selectedTab === "mods";

  return (
    <>
      <PageHeader
        isFullWidth
        className="bg-surface-low"
        pictogramName="nexus-mods"
        subtitle={subtitle}
        isBeta={isModsTab}
        title={t("Browse")}
      >
        <TabBar>
          <TabButton
            count={isModsEnabled ? mods.allModsTotal : undefined}
            name={t("Mods")}
            panelId="mods"
          />

          {supportsCollections && (
            <TabButton
              count={collections.allCollectionsTotal}
              name={t("Collections")}
              panelId="collections"
            />
          )}
        </TabBar>
      </PageHeader>

      <TabPanel
        className={joinClasses([
          "flex min-h-0 flex-1 flex-col",
          !isModsEnabled && "bg-surface-low",
        ])}
        id="mods"
      >
        {isModsEnabled ? (
          <BrowseMods api={api} isShown={isModsShown} search={mods} />
        ) : (
          <ModsComingSoon api={api} />
        )}
      </TabPanel>

      {supportsCollections && (
        <TabPanel className="flex min-h-0 flex-1 flex-col bg-surface-low" id="collections">
          <BrowseCollections api={api} search={collections} />
        </TabPanel>
      )}
    </>
  );
};
