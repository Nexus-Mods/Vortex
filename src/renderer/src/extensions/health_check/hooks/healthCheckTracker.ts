import type { MixpanelEvent } from "@/extensions/analytics/mixpanel/MixpanelEvents";
import type { IExtensionApi } from "@/types/IExtensionContext";

import type { BannerPlacement } from "../components/premium_banner/PremiumBanner";
import type { PremiumTrigger } from "../components/premium_modal/PremiumModal";
import type {
  HealthCheckTab,
  IssueAnalyticsIdentity,
  IssueType,
  OptionalIssueAnalyticsIdentity,
  RequirementState,
  ResolutionType,
} from "../utils/shared/tracking";

/** Which free-user fallback the premium modal offered. */
type PremiumFallbackType = "single_mod_page" | "batch_mod_pages";

/**
 * What the user was resolving. `option_count` is set only when the requirement offered
 * alternatives, which is what marks a resolution as an OR pick. Both are optional because
 * the mod-requirements check shares these events and has no versions, so no state to report.
 */
type ResolutionProps = {
  requirement_state?: RequirementState;
  option_count?: number;
};

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

    // Not in the original spec. Without it a bulk unhide is invisible, so ten issues
    // hidden then restored reads the same as ten left hidden, skewing the hide-rate KPI.
    trackUnhideAllClicked: (props: { issue_count_unhidden: number }) =>
      track("health_check_unhide_all_clicked", props),

    trackSettingsOpened: () => track("health_check_settings_opened"),

    trackOneClickInstallAllClicked: (props: { issue_count: number; mod_count: number }) =>
      track("health_check_one_click_install_all_clicked", props),

    // Detail view
    trackDetailViewed: (
      props: IssueAnalyticsIdentity & {
        issue_type: IssueType;
        resolution_type: ResolutionType;
        required_mod_count: number;
        source_mod_name: string;
      },
    ) => track("health_check_detail_viewed", props),

    trackBackClicked: (props: IssueAnalyticsIdentity & { time_spent_on_detail_ms: number }) =>
      track("health_check_back_clicked", props),

    // Install flow
    trackOneClickInstallClicked: (
      props: IssueAnalyticsIdentity &
        ResolutionProps & {
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
      props: OptionalIssueAnalyticsIdentity & {
        mod_id: number;
        mod_name: string;
        mod_version: string;
      },
    ) => track("health_check_install_started", props),

    trackInstallCompleted: (
      props: OptionalIssueAnalyticsIdentity & {
        mod_id: number;
        mod_name: string;
        mod_version: string;
        duration_ms: number;
      },
    ) => track("health_check_install_completed", props),

    trackInstallFailed: (
      props: OptionalIssueAnalyticsIdentity & { mod_id: number; error_reason: string },
    ) => track("health_check_install_failed", props),

    trackInstallDownloadedClicked: (
      props: IssueAnalyticsIdentity & ResolutionProps & { mod_id: number },
    ) => track("health_check_install_downloaded_clicked", props),

    // The listing row's bulk install of files already on disk, so no premium gate - unlike
    // install_all_in_group, which fetches from Nexus. Its items can mix requirement states.
    trackInstallAllDownloadedClicked: (props: IssueAnalyticsIdentity & { mod_count: number }) =>
      track("health_check_install_all_downloaded_clicked", props),

    trackInstallAllInGroupClicked: (
      props: IssueAnalyticsIdentity & { mod_count: number; requirement_state?: RequirementState },
    ) => track("health_check_install_all_in_group_clicked", props),

    // Enable flow
    trackEnableClicked: (
      props: IssueAnalyticsIdentity &
        ResolutionProps & { mod_id: number; mod_name: string; mod_version: string },
    ) => track("health_check_enable_clicked", props),

    trackEnableThisVersionClicked: (
      props: IssueAnalyticsIdentity &
        ResolutionProps & {
          mod_id: number;
          required_version: string;
          current_version: string;
        },
    ) => track("health_check_enable_this_version_clicked", props),

    // Pick flow. This is navigation to the alternatives; which one the user picks is reported
    // by that resolution's own event, carrying option_count.
    trackViewPickOptionsClicked: (props: IssueAnalyticsIdentity) =>
      track("health_check_view_pick_options_clicked", props),

    // Navigation & external
    trackInstallViaModPageClicked: (
      props: IssueAnalyticsIdentity &
        ResolutionProps & { mod_id: number; mod_name: string; mod_version: string },
    ) => track("health_check_install_via_mod_page_clicked", props),

    trackViewModPageClicked: (
      props: IssueAnalyticsIdentity & { mod_id: number; mod_name: string; mod_version: string },
    ) => track("health_check_view_mod_page_clicked", props),

    trackViewInModsClicked: (
      props: IssueAnalyticsIdentity & { mod_id: number; mod_name: string },
    ) => track("health_check_view_in_mods_clicked", props),

    trackSuggestionSourceLinkClicked: (props: IssueAnalyticsIdentity & { mod_id: number }) =>
      track("health_check_suggestion_source_link_clicked", props),

    // Premium modal. Scope is optional: the install-all upsell is raised from the
    // listing, across both checks, so it has no single issue or check to name.
    trackPremiumModalShown: (
      props: OptionalIssueAnalyticsIdentity & {
        trigger: PremiumTrigger;
        mod_id?: number;
        mod_count?: number;
      },
    ) => track("health_check_premium_modal_shown", props),

    trackPremiumModalDismissed: (
      props: OptionalIssueAnalyticsIdentity & { trigger: PremiumTrigger },
    ) => track("health_check_premium_modal_dismissed", props),

    trackPremiumModalUnlockClicked: (
      props: OptionalIssueAnalyticsIdentity & { trigger: PremiumTrigger; mod_count?: number },
    ) => track("health_check_premium_modal_unlock_clicked", props),

    trackPremiumModalFallbackClicked: (
      props: OptionalIssueAnalyticsIdentity & {
        trigger: PremiumTrigger;
        fallback_type: PremiumFallbackType;
        mod_count?: number;
      },
    ) => track("health_check_premium_modal_fallback_clicked", props),

    // Premium banner. Scope is set on a detail page and absent on the listing.
    trackPremiumBannerShown: (
      props: OptionalIssueAnalyticsIdentity & { placement: BannerPlacement; total_issues: number },
    ) => track("health_check_premium_banner_shown", props),

    trackPremiumBannerClicked: (
      props: OptionalIssueAnalyticsIdentity & { placement: BannerPlacement; total_issues: number },
    ) => track("health_check_premium_banner_clicked", props),

    trackFeedbackHelpful: (
      props: IssueAnalyticsIdentity & { issue_type: IssueType; resolution_type: ResolutionType },
    ) => track("health_check_feedback_helpful", props),

    trackFeedbackNotHelpful: (
      props: IssueAnalyticsIdentity & {
        issue_type: IssueType;
        resolution_type: ResolutionType;
        feedback_reasons: string[];
      },
    ) => track("health_check_feedback_not_helpful", props),

    trackFeedbackDismissed: (props: IssueAnalyticsIdentity & { issue_type: IssueType }) =>
      track("health_check_feedback_dismissed", props),

    // Visibility
    trackIssueHidden: (
      props: IssueAnalyticsIdentity & { issue_type: IssueType; resolution_type?: ResolutionType },
    ) => track("health_check_issue_hidden", props),

    trackIssueUnhidden: (props: IssueAnalyticsIdentity & { issue_type: IssueType }) =>
      track("health_check_issue_unhidden", props),
  };
};

export type HealthCheckTracker = ReturnType<typeof createHealthCheckTracker>;
