import { VortexGameId } from "@vortex/shared";
import type { TFunction } from "i18next";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { useFlag } from "@/contexts/FlagsContext";
import { isTierZeroManagedGame } from "@/extensions/gamemode_management/tiered/tierZero";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { TabBar } from "@/ui/components/tabs/TabBar";
import { TabButton } from "@/ui/components/tabs/TabButton";
import { TabPanel } from "@/ui/components/tabs/TabPanel";
import { TabProvider } from "@/ui/components/tabs/Tabs.context";
import { joinClasses } from "@/ui/utils/joinClasses";
import { activeGameId } from "@/util/selectors";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";

import { currentGame } from "../../../gamemode_management/selectors";
import { BrowseCollections } from "../../components/browse_collections/BrowseCollections";
import { BrowseMods } from "../../components/browse_mods/BrowseMods";
import { ModsComingSoon } from "../../components/mods_coming_soon/ModsComingSoon";
import { useCollectionSearch } from "../../hooks/use_collection_search/useCollectionSearch.hook";

/** What the page is for, naming the game when there is one. */
const pageSubtitle = (t: TFunction, gameName: string | undefined) => {
  if (!gameName) {
    return t("Discover and install mods.");
  }

  return t("Discover and install mods for {{game}}.", { game: gameName });
};

interface IBrowsePageProps {
  active?: boolean;
  api: IExtensionApi;
}

/**
 * Browsing a game's mods and collections, a tab each in the header (LAZ-1346). The
 * collections are the live browser; the mods are a static wireframe, its parts with no
 * component yet placeholders that say what they will be. The mods are behind the
 * `laz-vortex-browse-mods` flag, and say they're coming soon while it's off, when the page opens
 * on the collections instead.
 */
export const BrowsePage = ({ active, api }: IBrowsePageProps) => {
  const { t } = useTranslation();
  const subtitle = pageSubtitle(t, useSelector(currentGame)?.name);
  const collections = useCollectionSearch(api);
  const isModsEnabled = !!useFlag("laz-vortex-browse-mods");
  const [section, setSection] = useState<string>();
  const collectionsHidden = useSelector((state: IState) => {
    const gameId = activeGameId(state);
    return gameId === undefined ? false : isTierZeroManagedGame(state, VortexGameId(gameId));
  });
  const defaultSection = isModsEnabled ? "mods" : "collections";

  return (
    <Page isFullWidth active={active} pageId="browse-mods" scrollable={false}>
      <TabProvider
        tab={collectionsHidden ? "mods" : (section ?? defaultSection)}
        tabListId="browse-sections"
        onSetSelectedTab={setSection}
      >
        <PageHeader
          isFullWidth
          className="bg-surface-low"
          pictogramName="nexus-mods"
          subtitle={subtitle}
          title={t("Browse")}
        >
          <TabBar>
            <TabButton count={isModsEnabled ? 1480 : undefined} name={t("Mods")} panelId="mods" />

            {!collectionsHidden && (
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
          {isModsEnabled ? <BrowseMods /> : <ModsComingSoon api={api} />}
        </TabPanel>

        {!collectionsHidden && (
          <TabPanel className="flex min-h-0 flex-1 flex-col bg-surface-low" id="collections">
            <BrowseCollections api={api} search={collections} />
          </TabPanel>
        )}
      </TabProvider>
    </Page>
  );
};

export default BrowsePage;
