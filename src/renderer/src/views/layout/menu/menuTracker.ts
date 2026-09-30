import type { MixpanelEvent } from "@/extensions/analytics/mixpanel/MixpanelEvents";
import type { IExtensionApi } from "@/types/IExtensionContext";

/** Analytics for the menu. game_id and the rest arrive as super properties. */
export const createMenuTracker = (api: IExtensionApi) => {
  const track = (eventName: string, properties: Record<string, unknown> = {}) => {
    const event: MixpanelEvent = { eventName, properties };
    api.events.emit("analytics-track-mixpanel-event", event);
  };

  return {
    // The press, not the deploy's outcome. The toolbar's Deploy is app_toolbar_action_clicked,
    // so the two together show which one people apply from.
    trackApplyClicked: () => track("app_apply_clicked"),
  };
};

export type MenuTracker = ReturnType<typeof createMenuTracker>;
