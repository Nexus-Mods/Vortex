import type { MixpanelEvent } from "@/extensions/analytics/mixpanel/MixpanelEvents";
import type { IExtensionApi } from "@/types/IExtensionContext";

import type { BannerPlacement } from "../components/premium_banner/PremiumBanner";
import type { PremiumTrigger } from "../components/premium_modal/PremiumModal";
import type {
  HealthCheckTab,
  IssueIdentity,
  IssueType,
  OptionalIssueIdentity,
  ResolutionType,
} from "../utils/shared/tracking";

/** Which free-user fallback the premium modal offered. */
type PremiumFallbackType = "single_mod_page" | "batch_mod_pages";

/**
 * Build a Health Check analytics event. Returns the app-wide MixpanelEvent shape so it
 * rides the `analytics-track-mixpanel-event` bus, but lives here rather than in the
 * shared MixpanelEvents catalogue so the feature owns its own events. Strips `undefined`
 * values so optional props don't get sent as null. game_id / profile_id / user_type are
 * attached globally as super properties, never here.
 */
const healthCheckEvent = (
  eventName: string,
  properties: Record<string, unknown> = {},
): MixpanelEvent => ({
  eventName,
  properties: Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  ),
});

/**
 * Centralised Health Check analytics (LAZ-551). One typed surface for every
 * event so components emit intent (`trackDetailViewed(...)`) instead of building
 * Mixpanel events by hand. game_id / profile_id / user_type ride along as global
 * super properties, so no event repeats them. Consent gating is handled centrally
 * by the analytics extension — callers don't check it.
 *
 * A pure factory (no React): the tracking context memoises one per api, and the
 * non-React callers (the scan events, the install actions) build their own.
 */
export const createHealthCheckTracker = (api: IExtensionApi) => {
  const track = (eventName: string, properties: Record<string, unknown> = {}) => {
    api.events.emit("analytics-track-mixpanel-event", healthCheckEvent(eventName, properties));
  };

  return {
    // Page-level
    trackPageViewed: (props: {
      active_issue_count: number;
      hidden_issue_count: number;
      warning_count: number;
      suggestion_count: number;
      last_scan_timestamp?: number;
    }) => track("health_check_page_viewed", props),

    trackPassedViewed: () => track("health_check_passed_viewed"),

    // Scan lifecycle. Emitted by the non-React api layer around every check run,
    // manual (refresh button) or automatic (game / profile / mods / settings change).
    trackScanTriggered: (props: { is_manual: boolean; previous_issue_count: number }) =>
      track("health_check_scan_triggered", props),

    trackScanCompleted: (props: {
      duration_ms: number;
      total_issues_found: number;
      warning_count: number;
      suggestion_count: number;
      health_check_passed: boolean;
    }) => track("health_check_scan_completed", props),

    trackTabSwitched: (props: { tab: HealthCheckTab; issue_count_in_tab: number }) =>
      track("health_check_tab_switched", props),

    trackHideAllClicked: (props: { issue_count_hidden: number }) =>
      track("health_check_hide_all_clicked", props),

    trackSettingsOpened: () => track("health_check_settings_opened"),

    trackOneClickInstallAllClicked: (props: { issue_count: number; mod_count: number }) =>
      track("health_check_one_click_install_all_clicked", props),

    // Detail view
    trackDetailViewed: (
      props: IssueIdentity & {
        issue_type: IssueType;
        resolution_type: ResolutionType;
        required_mod_count: number;
        source_mod_name: string;
      },
    ) => track("health_check_detail_viewed", props),

    trackBackClicked: (props: IssueIdentity & { time_spent_on_detail_ms: number }) =>
      track("health_check_back_clicked", props),

    // Install flow
    trackOneClickInstallClicked: (
      props: IssueIdentity & {
        mod_id: number;
        mod_name: string;
        mod_version: string;
        is_adult_content: boolean;
      },
    ) => track("health_check_one_click_install_clicked", props),

    // Install lifecycle, bracketing the actual download + install a health-check action
    // kicks off (see trackedInstall). The app-wide mods_installation_* events cover the
    // install itself for every source; these are the health-check funnel's own view of it,
    // carrying the issue identity and spanning the download too. The identity is optional
    // because the actions stay callable without analytics context.
    trackInstallStarted: (
      props: OptionalIssueIdentity & { mod_id: number; mod_name: string; mod_version: string },
    ) => track("health_check_install_started", props),

    trackInstallCompleted: (
      props: OptionalIssueIdentity & {
        mod_id: number;
        mod_name: string;
        mod_version: string;
        duration_ms: number;
      },
    ) => track("health_check_install_completed", props),

    trackInstallFailed: (props: OptionalIssueIdentity & { mod_id: number; error_reason: string }) =>
      track("health_check_install_failed", props),

    trackInstallDownloadedClicked: (props: IssueIdentity & { mod_id: number; mod_count: number }) =>
      track("health_check_install_downloaded_clicked", props),

    trackInstallAllInGroupClicked: (props: IssueIdentity & { mod_count: number }) =>
      track("health_check_install_all_in_group_clicked", props),

    // Enable flow
    trackEnableClicked: (
      props: IssueIdentity & { mod_id: number; mod_name: string; mod_version: string },
    ) => track("health_check_enable_clicked", props),

    trackEnableThisVersionClicked: (
      props: IssueIdentity & {
        mod_id: number;
        required_version: string;
        current_version: string;
      },
    ) => track("health_check_enable_this_version_clicked", props),

    // Pick flow
    trackPickModInstallClicked: (props: IssueIdentity & { issue_type: IssueType }) =>
      track("health_check_pick_mod_install_clicked", props),

    trackPickOptionSelected: (
      props: IssueIdentity & {
        mod_id: number;
        mod_name: string;
        option_position: number;
        total_options: number;
      },
    ) => track("health_check_pick_option_selected", props),

    // Navigation & external
    trackInstallViaModPageClicked: (
      props: IssueIdentity & { mod_id: number; mod_name: string; mod_version: string },
    ) => track("health_check_install_via_mod_page_clicked", props),

    trackViewModPageClicked: (
      props: IssueIdentity & { mod_id: number; mod_name: string; mod_version: string },
    ) => track("health_check_view_mod_page_clicked", props),

    trackViewInModsClicked: (props: IssueIdentity & { mod_id: number; mod_name: string }) =>
      track("health_check_view_in_mods_clicked", props),

    trackSuggestionSourceLinkClicked: (props: IssueIdentity & { mod_id: number }) =>
      track("health_check_suggestion_source_link_clicked", props),

    // Premium modal. Scope is optional: the install-all upsell is raised from the
    // listing, across both checks, so it has no single issue or check to name.
    trackPremiumModalShown: (
      props: OptionalIssueIdentity & {
        trigger: PremiumTrigger;
        mod_id?: number;
        mod_count?: number;
      },
    ) => track("health_check_premium_modal_shown", props),

    trackPremiumModalDismissed: (props: OptionalIssueIdentity & { trigger: PremiumTrigger }) =>
      track("health_check_premium_modal_dismissed", props),

    trackPremiumModalUnlockClicked: (
      props: OptionalIssueIdentity & { trigger: PremiumTrigger; mod_count?: number },
    ) => track("health_check_premium_modal_unlock_clicked", props),

    trackPremiumModalFallbackClicked: (
      props: OptionalIssueIdentity & {
        trigger: PremiumTrigger;
        fallback_type: PremiumFallbackType;
        mod_count?: number;
      },
    ) => track("health_check_premium_modal_fallback_clicked", props),

    // Premium banner. Scope is set on a detail page and absent on the listing.
    trackPremiumBannerShown: (
      props: OptionalIssueIdentity & { placement: BannerPlacement; total_issues: number },
    ) => track("health_check_premium_banner_shown", props),

    trackPremiumBannerClicked: (
      props: OptionalIssueIdentity & { placement: BannerPlacement; total_issues: number },
    ) => track("health_check_premium_banner_clicked", props),

    // Visibility
    trackIssueHidden: (
      props: IssueIdentity & { issue_type: IssueType; resolution_type?: ResolutionType },
    ) => track("health_check_issue_hidden", props),

    trackIssueUnhidden: (props: IssueIdentity & { issue_type: IssueType }) =>
      track("health_check_issue_unhidden", props),
  };
};

export type HealthCheckTracker = ReturnType<typeof createHealthCheckTracker>;
