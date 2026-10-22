import { VortexGameId } from "@vortex/shared";
import type { TFunction } from "i18next";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { isTierZeroManagedGame } from "@/extensions/gamemode_management/tiered/tierZero";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { TabBar } from "@/ui/components/tabs/TabBar";
import { TabButton } from "@/ui/components/tabs/TabButton";
import { TabPanel } from "@/ui/components/tabs/TabPanel";
import { TabProvider } from "@/ui/components/tabs/Tabs.context";
import { activeGameId } from "@/util/selectors";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";

import { currentGame } from "../../../gamemode_management/selectors";
import { BrowseCollections } from "../../components/browse_collections/BrowseCollections";
import { BrowseMods } from "../../components/browse_mods/BrowseMods";
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
 * component yet placeholders that say what they will be.
 */
export const BrowsePage = ({ active, api }: IBrowsePageProps) => {
  const { t } = useTranslation();
  const subtitle = pageSubtitle(t, useSelector(currentGame)?.name);
  const collections = useCollectionSearch(api);
  const [section, setSection] = useState("mods");
  const collectionsHidden = useSelector((state: IState) => {
    const gameId = activeGameId(state);
    return gameId === undefined ? false : isTierZeroManagedGame(state, VortexGameId(gameId));
  });

  return (
    <Page isFullWidth active={active} pageId="browse-mods" scrollable={false}>
      <TabProvider
        tab={collectionsHidden && section === "collections" ? "mods" : section}
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
            <TabButton count={1480} name={t("Mods")} panelId="mods" />

            {!collectionsHidden && (
              <TabButton
                count={collections.allCollectionsTotal}
                name={t("Collections")}
                panelId="collections"
              />
            )}
          </TabBar>
        </PageHeader>

        <TabPanel className="flex min-h-0 flex-1 flex-col" id="mods">
          <BrowseMods />
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
