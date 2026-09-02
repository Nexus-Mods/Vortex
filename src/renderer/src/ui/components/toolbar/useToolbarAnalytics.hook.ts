import { useMemo } from "react";

import { useMainContext } from "@/contexts";
import type { MixpanelEvent } from "@/extensions/analytics/mixpanel/MixpanelEvents";

import type { IToolbarActionIdentity, IToolbarAnalytics, ToolbarSurface } from "./Toolbar.context";

/** What every toolbar event about a single button says: which one, on which toolbar. */
interface IToolbarActionEvent {
  action: IToolbarActionIdentity;
  toolbar: string;
}

const actionProperties = ({ action: { extension, id }, toolbar }: IToolbarActionEvent) => ({
  action: id,
  toolbar,
  // Left out entirely rather than sent empty, so the property's presence is itself
  // the answer to "did this come from an extension?"
  ...(extension === undefined ? {} : { extension }),
});

/**
 * Says that an action on a page toolbar was clicked, so that a toolbar being redesigned
 * can be cut down on evidence rather than on guesswork — which buttons are clicked, how
 * often, and whether people reach them on the bar or through the kebab.
 */
const toolbarActionClickedEvent = ({
  surface,
  ...event
}: IToolbarActionEvent & { surface: ToolbarSurface }): MixpanelEvent => ({
  eventName: "toolbar_action_clicked",
  properties: { ...actionProperties(event), surface },
});

/**
 * Says that the user pinned or unpinned an action. Together with the click events this
 * is what the toolbar redesign is asking about: which buttons people want in front of
 * them, as opposed to which they merely end up pressing.
 */
const toolbarPinChangedEvent = ({
  pinned,
  ...event
}: IToolbarActionEvent & { pinned: boolean }): MixpanelEvent => ({
  eventName: "toolbar_pin_changed",
  properties: { ...actionProperties(event), pinned },
});

/**
 * Says that the user gave up on their own arrangement and took the toolbar back to
 * its defaults — which says something about the defaults that the individual pins
 * do not.
 */
const toolbarPinsResetEvent = ({ toolbar }: { toolbar: string }): MixpanelEvent => ({
  eventName: "toolbar_pins_reset",
  properties: { toolbar },
});

/**
 * Usage tracking for one page's toolbar, as the callbacks {@link Toolbar} takes.
 *
 * Opting a toolbar in is the single line that hands the result to it — a toolbar without
 * it reports nothing, which is every toolbar but the mods page's for now. That is also
 * what keeps the components themselves free of analytics: they are handed callbacks and
 * forward identity through them, and this is the only part that knows where it goes.
 *
 * None of the events carry game, version or user scope of their own: those are Mixpanel
 * super properties registered once at startup and kept current on game switch.
 *
 * @param toolbar Names the toolbar in every event, e.g. `"mods"`.
 */
export const useToolbarAnalytics = (toolbar: string): IToolbarAnalytics => {
  const { api } = useMainContext();

  return useMemo(
    () => ({
      onActionClick: (action: IToolbarActionIdentity, surface: ToolbarSurface) => {
        api.events.emit(
          "analytics-track-mixpanel-event",
          toolbarActionClickedEvent({ action, surface, toolbar }),
        );
      },
      onPinChange: (action: IToolbarActionIdentity, pinned: boolean) => {
        api.events.emit(
          "analytics-track-mixpanel-event",
          toolbarPinChangedEvent({ action, pinned, toolbar }),
        );
      },
      onPinsReset: () => {
        api.events.emit("analytics-track-mixpanel-event", toolbarPinsResetEvent({ toolbar }));
      },
    }),
    [api, toolbar],
  );
};
