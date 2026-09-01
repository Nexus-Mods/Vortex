import { useCallback } from "react";

import { useMainContext } from "@/contexts";
import type { MixpanelEvent } from "@/extensions/analytics/mixpanel/MixpanelEvents";

import type { IToolbarActionIdentity, IToolbarContext, ToolbarSurface } from "./Toolbar.context";

/**
 * Says that an action on a page toolbar was clicked, so that a toolbar being redesigned can
 * be cut down on evidence rather than on guesswork — which buttons are clicked, how often,
 * and whether people reach them on the bar or dig them out of the overflow menu.
 *
 * Carries no game, version or user scope of its own: those are Mixpanel super properties
 * registered once at startup and kept current on game switch, so every event has them.
 */
const toolbarActionClickedEvent = (
  { extension, id }: IToolbarActionIdentity,
  surface: ToolbarSurface,
  toolbar: string,
): MixpanelEvent => ({
  eventName: "toolbar_action_clicked",
  properties: {
    action: id,
    surface,
    toolbar,
    ...(extension === undefined ? {} : { extension }),
  },
});

/**
 * Usage tracking for one page's toolbar, as the callback {@link Toolbar} takes.
 *
 * Opting a toolbar in is the single line that passes the result to it — a toolbar without
 * it reports nothing, which is every toolbar but the mods page's for now. That is also
 * what keeps the components themselves free of analytics: they are handed a callback and
 * forward identity through it, and this is the only part that knows where it goes.
 *
 * @param toolbar Names the toolbar in the event, e.g. `"mods"`.
 */
export const useToolbarAnalytics = (
  toolbar: string,
): NonNullable<IToolbarContext["onActionClick"]> => {
  const { api } = useMainContext();

  return useCallback(
    (action: IToolbarActionIdentity, surface: ToolbarSurface) => {
      api.events.emit(
        "analytics-track-mixpanel-event",
        toolbarActionClickedEvent(action, surface, toolbar),
      );
    },
    [api, toolbar],
  );
};
