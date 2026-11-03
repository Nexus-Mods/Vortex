import type { MixpanelEvent } from "@/extensions/analytics/mixpanel/MixpanelEvents";
import type { IExtensionApi } from "@/types/IExtensionContext";

import type {
  ModPreset,
  ModSortDirection,
  ModSortField,
  ModTimeRange,
} from "../use_mod_search/useModSearch.hook";

/** Where a time range was changed from. */
export type TimeRangeSource = "filter_menu" | "applied_filter" | "applied_filter_clear";

/** How a mod or picture was picked: clicked, or moved to with the keys. */
export type SelectionInput = "pointer" | "keyboard";

/** Which way the gallery's strip was paged. */
export type GalleryDirection = "back" | "forward";

/** The search a results event is about: its view, sort and time range. */
type SearchProps = {
  view: ModPreset;
  sort_field: ModSortField;
  sort_direction: ModSortDirection;
  time_range: ModTimeRange;
};

/** Builds a Browse mods event, leaving out `undefined` properties rather than sending null. */
const browseModsEvent = (
  eventName: string,
  properties: Record<string, unknown> = {},
): MixpanelEvent => ({
  eventName,
  properties: Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  ),
});

/**
 * Browse mods' analytics, one typed method per event. Game, profile and user ride along as
 * super properties, and consent is the analytics extension's, so neither is handled here. Mods
 * are sent as `mod_uid`, which Mixpanel's lookup table names. Pure, so it can be built outside
 * React; the page memoises one per api.
 */
export const createBrowseModsTracker = (api: IExtensionApi) => {
  const track = (eventName: string, properties?: Record<string, unknown>) => {
    api.events.emit("analytics-track-mixpanel-event", browseModsEvent(eventName, properties));
  };

  return {
    // The Mods tab coming into view: opening Browse on it, or switching to it.
    trackViewed: () => track("browse_mods_viewed"),

    // Sent again when the open view is picked, which puts its filters back.
    trackViewSelected: (props: { view: ModPreset; previous_view: ModPreset }) =>
      track("browse_mods_view_selected", props),

    // The sort as it is after the change; `is_reset` when View options' reset put it back.
    trackSortChanged: (props: {
      view: ModPreset;
      sort_field: ModSortField;
      sort_direction: ModSortDirection;
      is_reset: boolean;
    }) => track("browse_mods_sort_changed", props),

    trackTimeRangeChanged: (props: {
      view: ModPreset;
      time_range: ModTimeRange;
      previous_time_range: ModTimeRange;
      source: TimeRangeSource;
    }) => track("browse_mods_time_range_changed", props),

    // `filter_count` is how many differed from the view's own, which the reset puts back.
    trackFiltersReset: (props: { view: ModPreset; filter_count: number }) =>
      track("browse_mods_filters_reset", props),

    // `position` counts from 1 across pages, so the 3rd mod on page 2 of 20 is 23. Moving
    // through the list with the keys picks each mod it passes, each counted as `keyboard`.
    trackModSelected: (props: {
      mod_uid: string;
      view: ModPreset;
      position: number;
      input: SelectionInput;
    }) => track("browse_mods_mod_selected", props),

    trackModPageOpened: (props: { mod_uid: string }) => track("browse_mods_mod_page_opened", props),

    // `image_index` counts from 1, as `position` does; the keys on the strip pick too, counted as
    // `keyboard`.
    trackGalleryImageSelected: (props: {
      mod_uid: string;
      image_index: number;
      image_count: number;
      input: SelectionInput;
    }) => track("browse_mods_gallery_image_selected", props),

    // Placeholders for images from outside Nexus Mods in a mod's description: sent once per mod,
    // with how many images they stand for and how many placeholders that took.
    trackExternalImagesShown: (props: {
      mod_uid: string;
      image_count: number;
      placeholder_count: number;
    }) => track("browse_mods_external_images_shown", props),

    // From a placeholder, or its Why? dialog; `image_count` is the placeholder's.
    trackExternalImagesWebsiteOpened: (props: {
      mod_uid: string;
      image_count: number;
      source: "placeholder" | "dialog";
    }) => track("browse_mods_external_images_website_opened", props),

    trackExternalImagesWhyOpened: (props: { mod_uid: string }) =>
      track("browse_mods_external_images_why_opened", props),

    trackExternalImageLinkOpened: (props: { mod_uid: string; link_domain: string }) =>
      track("browse_mods_external_image_link_opened", props),

    trackGalleryPaged: (props: { mod_uid: string; direction: GalleryDirection }) =>
      track("browse_mods_gallery_paged", props),

    // Once per search that comes back empty.
    trackNoResults: (props: SearchProps) => track("browse_mods_no_results", props),

    trackRetryClicked: (props: SearchProps & { page: number }) =>
      track("browse_mods_retry_clicked", props),
  };
};

export type BrowseModsTracker = ReturnType<typeof createBrowseModsTracker>;
