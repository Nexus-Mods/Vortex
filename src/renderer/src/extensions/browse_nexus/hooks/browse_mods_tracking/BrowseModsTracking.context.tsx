import { createContext, useContext } from "react";

import type { BrowseModsTracker } from "./browseModsTracker";

/** The Browse page's tracker, so its components say what happened without being handed it. */
export const BrowseModsTrackingContext = createContext<BrowseModsTracker | undefined>(undefined);

/** The Browse page's tracker; throws outside its provider, so a missed one can't go silent. */
export const useBrowseModsTracker = (): BrowseModsTracker => {
  const tracker = useContext(BrowseModsTrackingContext);

  if (!tracker) {
    throw new Error("useBrowseModsTracker must be used within BrowseModsTrackingContext");
  }

  return tracker;
};
