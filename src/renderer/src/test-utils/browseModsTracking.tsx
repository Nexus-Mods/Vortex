import React, { type ReactNode } from "react";
import { vi } from "vitest";

import { MainContext } from "@/contexts/MainContext";
import type { MixpanelEvent } from "@/extensions/analytics/mixpanel/MixpanelEvents";
import { createBrowseModsTracker } from "@/extensions/browse_nexus/hooks/browse_mods_tracking/browseModsTracker";
import { BrowseModsTrackingContext } from "@/extensions/browse_nexus/hooks/browse_mods_tracking/BrowseModsTracking.context";
import type { IExtensionApi } from "@/types/IExtensionContext";

/**
 * A Browse mods tracker on a spied bus: `wrapper` provides it, and the api the toolbar's own
 * tracking reads, to a render, and `tracked` lists the events sent, or those of one name.
 */
export const browseModsTracking = () => {
  const emit = vi.fn();
  const api = { events: { emit } } as unknown as IExtensionApi;
  const tracker = createBrowseModsTracker(api);

  const wrapper = ({ children }: { children?: ReactNode }) => (
    <MainContext.Provider
      value={{
        api,
        menuLayer: undefined,
        getModifiers: () => ({ alt: false, ctrl: false, shift: false }),
      }}
    >
      <BrowseModsTrackingContext.Provider value={tracker}>
        {children}
      </BrowseModsTrackingContext.Provider>
    </MainContext.Provider>
  );

  const tracked = (eventName?: string) =>
    emit.mock.calls
      .filter(([bus]) => bus === "analytics-track-mixpanel-event")
      .map(([, event]) => event as MixpanelEvent)
      .filter((event) => !eventName || event.eventName === eventName);

  return { emit, wrapper, tracked };
};
