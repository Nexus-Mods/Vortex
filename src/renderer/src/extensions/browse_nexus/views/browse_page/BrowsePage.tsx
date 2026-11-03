import { VortexGameId } from "@vortex/shared";
import React, { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import { useFlag } from "@/contexts/FlagsContext";
import { isTierZeroManagedGame } from "@/extensions/gamemode_management/tiered/tierZero";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { TabProvider } from "@/ui/components/tabs/Tabs.context";
import { activeGameId } from "@/util/selectors";
import { Page } from "@/views/components/Page/Page";

import { setBrowseSection } from "../../actions/session";
import { createBrowseModsTracker } from "../../hooks/browse_mods_tracking/browseModsTracker";
import { BrowseModsTrackingContext } from "../../hooks/browse_mods_tracking/BrowseModsTracking.context";
import { type BrowseSection, isBrowseSection } from "../../util/browseSection";
import { BrowseSections } from "./browse_sections/BrowseSections";

interface IBrowsePageProps {
  active?: boolean;
  api: IExtensionApi;
}

/**
 * Browsing a game's mods and collections, a tab each in the header. The open tab is session
 * state, so it's kept while the page is left and a link from elsewhere, such as Discover more
 * collections, can pick it. The mods are behind the `laz-vortex-browse-mods` flag, and say
 * they're coming soon while it's off, when the page opens on the collections instead. The tab
 * picked outlasts changing game; everything under it starts over. Counts the mods coming into
 * view, whether by opening the page on them or switching tab.
 */
export const BrowsePage = ({ active, api }: IBrowsePageProps) => {
  const gameId = useSelector(activeGameId);
  const isModsEnabled = !!useFlag("laz-vortex-browse-mods");
  const section = useSelector((state: IState) => state.session.browse.section);
  const dispatch = useDispatch();

  const supportsCollections = useSelector(
    (state: IState) => !gameId || !isTierZeroManagedGame(state, VortexGameId(gameId)),
  );
  const defaultSection: BrowseSection = isModsEnabled ? "mods" : "collections";
  const tab = supportsCollections ? (section ?? defaultSection) : "mods";
  const isModsShown = !!active && isModsEnabled && tab === "mods";
  const tracker = useMemo(() => createBrowseModsTracker(api), [api]);

  useEffect(() => {
    if (isModsShown) {
      tracker.trackViewed();
    }
  }, [isModsShown, tracker]);

  return (
    <Page isFullWidth active={active} pageId="browse-mods" scrollable={false}>
      <BrowseModsTrackingContext.Provider value={tracker}>
        <TabProvider
          tab={tab}
          tabListId="browse-sections"
          onSetSelectedTab={(selected) => {
            if (isBrowseSection(selected)) {
              dispatch(setBrowseSection(selected));
            }
          }}
        >
          <BrowseSections
            api={api}
            isModsEnabled={isModsEnabled}
            isModsShown={isModsShown}
            key={gameId}
            supportsCollections={supportsCollections}
          />
        </TabProvider>
      </BrowseModsTrackingContext.Provider>
    </Page>
  );
};

export default BrowsePage;
