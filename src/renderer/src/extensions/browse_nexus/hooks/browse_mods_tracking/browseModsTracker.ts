import type { MixpanelEvent } from "@/extensions/analytics/mixpanel/MixpanelEvents";
import type { IExtensionApi } from "@/types/IExtensionContext";

import type {
  TrackedView,
  ModAdultContent,
  ModSortDirection,
  ModSortField,
  ModTimeRange,
} from "../../util/mod_views/modViews";

/**
 * Where a filter was changed from: its submenu or its reset there, or the chip the bar shows while
 * it's on, or that chip's remove.
 */
export type FilterSource =
  | "filter_menu"
  | "filter_reset"
  | "applied_filter"
  | "applied_filter_clear";

/** How a mod or picture was picked: clicked, or moved to with the keys. */
export type SelectionInput = "pointer" | "keyboard";

/** Which way the gallery's strip was paged. */
export type GalleryDirection = "back" | "forward";

/** The filters as the events name them; each filter gives its own. */
export type IFilterEventProps = {
  time_range: ModTimeRange;
  adult: ModAdultContent;
};

/** The search a results event is about: its view, sort and filters. */
export type ISearchEventProps = {
  view: TrackedView;
  sort_field: ModSortField;
  sort_direction: ModSortDirection;
} & IFilterEventProps;

/** The mod a 1-click upsell is for, and what the click would have done: install, download or update. */
type OneClickUpsellProps = { mod_uid: string; action: "install" | "download" | "update" };

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

    // Sent again when the open preset is picked with its filters changed, which puts them back.
    trackViewSelected: (props: { view: TrackedView; previous_view: TrackedView }) =>
      track("browse_mods_view_selected", props),

    // A view of the user's own, made from what's showing, renamed or deleted; `view` is what it
    // was made from, never its name.
    trackViewCreated: (props: { view: TrackedView; source: "picker" | "edited_strip" }) =>
      track("browse_mods_view_created", props),

    trackViewRenamed: () => track("browse_mods_view_renamed"),

    trackViewDeleted: () => track("browse_mods_view_deleted"),

    // The edited strip's Reset to default, putting a preset's sort and filters back.
    trackViewReset: (props: { view: TrackedView }) => track("browse_mods_view_reset", props),

    // The sort as it is after the change; `is_reset` when View options' reset put it back.
    trackSortChanged: (props: {
      view: TrackedView;
      sort_field: ModSortField;
      sort_direction: ModSortDirection;
      is_reset: boolean;
    }) => track("browse_mods_sort_changed", props),

    trackTimeRangeChanged: (props: {
      view: TrackedView;
      time_range: ModTimeRange;
      previous_time_range: ModTimeRange;
      source: FilterSource;
    }) => track("browse_mods_time_range_changed", props),

    trackAdultFilterChanged: (props: {
      view: TrackedView;
      adult: ModAdultContent;
      previous_adult: ModAdultContent;
      source: FilterSource;
    }) => track("browse_mods_adult_filter_changed", props),

    // `filter_count` is how many differed from the view's own, which the reset puts back.
    trackFiltersReset: (props: { view: TrackedView; filter_count: number }) =>
      track("browse_mods_filters_reset", props),

    // `position` counts from 1 across pages, so the 3rd mod on page 2 of 20 is 23. Moving
    // through the list with the keys picks each mod it passes, each counted as `keyboard`.
    trackModSelected: (props: {
      mod_uid: string;
      view: TrackedView;
      position: number;
      input: SelectionInput;
    }) => track("browse_mods_mod_selected", props),

    // 1-click download, by a Premium user or a free one once the upsell sees them unlock Premium;
    // `action` says whether it installs too, as the user's settings say. The download and install themselves are mods_download_* and
    // mods_installation_*.
    trackOneClickClicked: (props: {
      mod_uid: string;
      file_uid: string;
      action: "install" | "download";
    }) => track("browse_mods_one_click_clicked", props),

    // The upsell raised for a free user who clicked 1-click, and what they did with it; `action` as
    // on browse_mods_one_click_clicked, or `update` for a mod they have an update for.
    trackPremiumModalShown: (props: OneClickUpsellProps) =>
      track("browse_mods_premium_modal_shown", props),

    trackPremiumModalDismissed: (props: OneClickUpsellProps) =>
      track("browse_mods_premium_modal_dismissed", props),

    trackPremiumModalUnlockClicked: (props: OneClickUpsellProps) =>
      track("browse_mods_premium_modal_unlock_clicked", props),

    // Opened the mod's Files tab to download it from the website instead.
    trackPremiumModalFallbackClicked: (props: OneClickUpsellProps) =>
      track("browse_mods_premium_modal_fallback_clicked", props),

    // The details' button for a mod the user already has: installing its download, updating it as
    // the Mods page's update check says, or showing it on the Mods page.
    trackInstallClicked: (props: { mod_uid: string }) =>
      track("browse_mods_install_clicked", props),

    trackUpdateClicked: (props: { mod_uid: string }) => track("browse_mods_update_clicked", props),

    trackViewInstalledClicked: (props: { mod_uid: string }) =>
      track("browse_mods_view_installed_clicked", props),

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
    trackNoResults: (props: ISearchEventProps) => track("browse_mods_no_results", props),

    trackRetryClicked: (props: ISearchEventProps & { page: number }) =>
      track("browse_mods_retry_clicked", props),
  };
};

export type BrowseModsTracker = ReturnType<typeof createBrowseModsTracker>;
