import { useMemo } from "react";

import type { MixpanelEvent } from "@/extensions/analytics/mixpanel/MixpanelEvents";
import type { IExtensionApi } from "@/types/IExtensionContext";

import type {
  BannerContext,
  HealthCheckTab,
  IssueType,
  PremiumFallbackType,
  PremiumTriggerContext,
  ResolutionType,
} from "../utils/shared/tracking";

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
 * event so components emit intent (`trackIssueExpanded(...)`) instead of building
 * Mixpanel events by hand. game_id / profile_id / user_type ride along as global
 * super properties, so no event repeats them. Consent gating is handled centrally
 * by the analytics extension — callers don't check it.
 *
 * `createHealthCheckTracker` is the pure factory (no React) so it can be unit
 * tested directly; `useHealthCheckTracking` just memoises it per api.
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

    trackTabSwitched: (props: { tab: HealthCheckTab; issue_count_in_tab: number }) =>
      track("health_check_tab_switched", props),

    trackHideAllClicked: (props: { issue_count_hidden: number }) =>
      track("health_check_hide_all_clicked", props),

    trackSettingsOpened: () => track("health_check_settings_opened"),

    trackOneClickInstallAllClicked: (props: { issue_count: number; mod_count: number }) =>
      track("health_check_one_click_install_all_clicked", props),

    // Issue list
    trackIssueExpanded: (props: {
      issue_id: string;
      issue_type: IssueType;
      resolution_type: ResolutionType;
      mod_name: string;
      position_in_list: number;
    }) => track("health_check_issue_expanded", props),

    // Detail view
    trackDetailViewed: (props: {
      issue_id: string;
      issue_type: IssueType;
      resolution_type: ResolutionType;
      required_mod_count: number;
      source_mod_name: string;
    }) => track("health_check_detail_viewed", props),

    trackBackClicked: (props: { issue_id: string; time_spent_on_detail_ms: number }) =>
      track("health_check_back_clicked", props),

    // Install flow
    trackOneClickInstallClicked: (props: {
      issue_id: string;
      mod_id: number;
      mod_name: string;
      mod_version: string;
      is_adult_content: boolean;
    }) => track("health_check_one_click_install_clicked", props),

    trackInstallDownloadedClicked: (props: {
      issue_id: string;
      mod_id: number;
      mod_count: number;
    }) => track("health_check_install_downloaded_clicked", props),

    trackInstallAllInGroupClicked: (props: { issue_id: string; mod_count: number }) =>
      track("health_check_install_all_in_group_clicked", props),

    // Enable flow
    trackEnableClicked: (props: {
      issue_id: string;
      mod_id: number;
      mod_name: string;
      mod_version: string;
    }) => track("health_check_enable_clicked", props),

    trackEnableThisVersionClicked: (props: {
      issue_id: string;
      mod_id: number;
      required_version: string;
      current_version: string;
    }) => track("health_check_enable_this_version_clicked", props),

    trackEnableAllClicked: (props: { issue_id: string; mod_count: number }) =>
      track("health_check_enable_all_clicked", props),

    // Pick flow
    trackPickModInstallClicked: (props: { issue_id: string; issue_type: IssueType }) =>
      track("health_check_pick_mod_install_clicked", props),

    trackPickOptionSelected: (props: {
      issue_id: string;
      mod_id: number;
      mod_name: string;
      option_position: number;
      total_options: number;
    }) => track("health_check_pick_option_selected", props),

    // Navigation & external
    trackInstallViaModPageClicked: (props: {
      issue_id: string;
      mod_id: number;
      mod_name: string;
      mod_version: string;
    }) => track("health_check_install_via_mod_page_clicked", props),

    trackViewModPageClicked: (props: {
      issue_id: string;
      mod_id: number;
      mod_name: string;
      mod_version: string;
    }) => track("health_check_view_mod_page_clicked", props),

    trackViewInModsClicked: (props: { issue_id: string; mod_id: number; mod_name: string }) =>
      track("health_check_view_in_mods_clicked", props),

    trackSuggestionSourceLinkClicked: (props: { issue_id: string; mod_id: number }) =>
      track("health_check_suggestion_source_link_clicked", props),

    // Premium modal
    trackPremiumModalShown: (props: {
      trigger_context: PremiumTriggerContext;
      issue_id?: string;
      mod_id?: number;
      mod_count?: number;
    }) => track("health_check_premium_modal_shown", props),

    trackPremiumModalDismissed: (props: {
      trigger_context: PremiumTriggerContext;
      issue_id?: string;
    }) => track("health_check_premium_modal_dismissed", props),

    trackPremiumModalUnlockClicked: (props: {
      trigger_context: PremiumTriggerContext;
      issue_id?: string;
      mod_count?: number;
    }) => track("health_check_premium_modal_unlock_clicked", props),

    trackPremiumModalFallbackClicked: (props: {
      trigger_context: PremiumTriggerContext;
      fallback_type: PremiumFallbackType;
      issue_id?: string;
      mod_count?: number;
    }) => track("health_check_premium_modal_fallback_clicked", props),

    // Premium banner
    trackPremiumBannerShown: (props: {
      context: BannerContext;
      total_issues: number;
      issue_id?: string;
    }) => track("health_check_premium_banner_shown", props),

    trackPremiumBannerClicked: (props: {
      context: BannerContext;
      total_issues: number;
      issue_id?: string;
    }) => track("health_check_premium_banner_clicked", props),

    // Visibility
    trackIssueHidden: (props: {
      issue_id: string;
      issue_type: IssueType;
      resolution_type?: ResolutionType;
    }) => track("health_check_issue_hidden", props),

    trackIssueUnhidden: (props: { issue_id: string; issue_type: IssueType }) =>
      track("health_check_issue_unhidden", props),
  };
};

export type HealthCheckTracker = ReturnType<typeof createHealthCheckTracker>;

export const useHealthCheckTracking = (api: IExtensionApi): HealthCheckTracker =>
  useMemo(() => createHealthCheckTracker(api), [api]);
