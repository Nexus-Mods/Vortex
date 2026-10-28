import { VortexGameId } from "@vortex/shared";
import React, { useState } from "react";
import { useSelector } from "react-redux";

import { useFlag } from "@/contexts/FlagsContext";
import { isTierZeroManagedGame } from "@/extensions/gamemode_management/tiered/tierZero";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { TabProvider } from "@/ui/components/tabs/Tabs.context";
import { activeGameId } from "@/util/selectors";
import { Page } from "@/views/components/Page/Page";

import { BrowseSections } from "./browse_sections/BrowseSections";

interface IBrowsePageProps {
  active?: boolean;
  api: IExtensionApi;
}

/**
 * Browsing a game's mods and collections, a tab each in the header. The mods are
 * behind the
 * `laz-vortex-browse-mods` flag, and say they're coming soon while it's off, when the page opens
 * on the collections instead. The tab picked outlasts changing game; everything under it starts
 * over.
 */
export const BrowsePage = ({ active, api }: IBrowsePageProps) => {
  const gameId = useSelector(activeGameId);
  const isModsEnabled = !!useFlag("laz-vortex-browse-mods");
  const [section, setSection] = useState<string>();
  const supportsCollections = useSelector(
    (state: IState) => !gameId || !isTierZeroManagedGame(state, VortexGameId(gameId)),
  );
  const defaultSection = isModsEnabled ? "mods" : "collections";

  return (
    <Page isFullWidth active={active} pageId="browse-mods" scrollable={false}>
      <TabProvider
        tab={supportsCollections ? (section ?? defaultSection) : "mods"}
        tabListId="browse-sections"
        onSetSelectedTab={setSection}
      >
        <BrowseSections
          api={api}
          supportsCollections={supportsCollections}
          isModsEnabled={isModsEnabled}
          key={gameId}
        />
      </TabProvider>
    </Page>
  );
};

export default BrowsePage;
