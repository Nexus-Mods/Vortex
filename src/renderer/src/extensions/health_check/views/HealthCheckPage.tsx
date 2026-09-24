import {
  mdiCheckCircleOutline,
  mdiCogOutline,
  mdiInformationOutline,
  mdiMonitorArrowDownVariant,
  mdiEyeOutline,
  mdiEyeOffOutline,
  mdiRefresh,
} from "@mdi/js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { setDialogVisible, setOpenMainPage, setSettingsPage } from "@/actions/session";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { NoResults } from "@/ui/components/no_results/NoResults";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";
import { TabBar } from "@/ui/components/tabs/TabBar";
import { TabButton } from "@/ui/components/tabs/TabButton";
import { TabPanel } from "@/ui/components/tabs/TabPanel";
import { TabProvider } from "@/ui/components/tabs/Tabs.context";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import type { IToolbarAction } from "@/ui/components/toolbar/ToolbarGroup";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { Typography } from "@/ui/components/typography/Typography";
import { UserCanceled } from "@/util/CustomErrors";
import { useRelativeTime } from "@/util/useRelativeTime";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";
import { PageScroll } from "@/views/components/Page/PageScroll";

import { isLoggedIn, shouldShowPremiumAd } from "../../nexus_integration/selectors";
import { AuthorNotesModal } from "../components/author_notes_modal/AuthorNotesModal";
import { BetaBadge } from "../components/beta_badge/BetaBadge";
import { IssueSection } from "../components/issue_section/IssueSection";
import { PremiumBanner } from "../components/premium_banner/PremiumBanner";
import { PremiumModal } from "../components/premium_modal/PremiumModal";
import { createHealthCheckTracker } from "../hooks/healthCheckTracker";
import { HealthCheckTrackingProvider, IssueProvider } from "../hooks/HealthCheckTracking.context";
import {
  fileRequirementsCheckResult,
  hiddenFileRequirements,
  hiddenModRequirements,
  isAnyHealthCheckRunning,
  lastHealthCheckRun,
  modRequirementsCheckResult,
} from "../selectors";
import type { HealthCheckId } from "../types";
import {
  countIssues,
  groupByIssueType,
  type IListedEntry,
  selectListedEntries,
} from "../utils/shared/listedEntries";
import { type HealthCheckTab, type IssueType, issueTypeForCheck } from "../utils/shared/tracking";
import { healthCheckContent } from "./content/registry";
import type { IBulkInstallItem } from "./content/types";
import HealthCheckDetailPage from "./HealthCheckDetailPage";

interface IHealthCheckPageProps {
  api: IExtensionApi;
  onRefresh?: () => void;
  active?: boolean;
  /** Registers a handler the Menu calls when Health check is clicked while already active. */
  registerReset?: (cb: () => void) => void;
}

/**
 * "Last updated" header label. Leaf component: its periodic age tick and
 * per-result lastFullRun subscription re-render only this label. Renders
 * nothing until the first check run of the session.
 */
const LastUpdated = () => {
  const { t } = useTranslation(["health_check", "common"]);
  const lastRun = useSelector(lastHealthCheckRun);
  const time = useRelativeTime(lastRun, t);

  if (time === undefined) {
    return null;
  }

  return (
    <Typography appearance="subdued" brand="neutral-translucent" typographyType="body-sm">
      {t("listing::last_updated", { time })}
    </Typography>
  );
};

/** No-choice install items from every check, split by issue type and de-duplicated by key. */
const collectInstallAllItems = (
  state: IState,
  api: IExtensionApi,
): Record<IssueType, IBulkInstallItem[]> => {
  const out: Record<IssueType, IBulkInstallItem[]> = { warning: [], suggestion: [] };
  const seen = new Map<string, IBulkInstallItem>();

  for (const [checkId, content] of Object.entries(healthCheckContent)) {
    const bucket = out[issueTypeForCheck(checkId as HealthCheckId)];

    for (const item of content?.collectInstallAll?.(state, api) ?? []) {
      const kept = seen.get(item.key);

      if (kept) {
        // one install for a mod several others require: list them all, keep the first note
        kept.requiredFor = [...new Set([...(kept.requiredFor ?? []), ...(item.requiredFor ?? [])])];
        kept.notedRequirement ??= item.notedRequirement;
      } else {
        const copy = { ...item };
        seen.set(item.key, copy);
        bucket.push(copy);
      }
    }
  }

  return out;
};

const HealthCheckPage = ({ api, onRefresh, active, registerReset }: IHealthCheckPageProps) => {
  const { t } = useTranslation(["health_check", "common"]);
  const dispatch = useDispatch();
  const [selected, setSelected] = useState<IListedEntry | null>(null);
  const [selectedTab, setSelectedTab] = useState("active");

  const {
    trackPageViewed,
    trackPassedViewed,
    trackTabSwitched,
    trackHideAllClicked,
    trackUnhideAllClicked,
    trackSettingsOpened,
    trackOneClickInstallAllClicked,
  } = useMemo(() => createHealthCheckTracker(api), [api]);

  // Clicking the Health check menu item while already on the page returns to
  // the listing (closes any open detail). setSelected is stable, so registering
  // once on mount is enough.
  useEffect(() => {
    registerReset?.(() => setSelected(null));
  }, [registerReset]);

  // Subscribe only to the slices the listing + install-all derive from, so the
  // frequent unrelated dispatches during a check run (mod-file and mod-attribute
  // caching) don't recompute the list. setSafe preserves these refs across those
  // writes, so the memos recompute only when results or hidden state actually
  // change. The running-state boolean drives the refresh spinner, re-rendering
  // (not recomputing) the page on run start/finish; the per-result lastFullRun
  // subscription lives in LastUpdated.
  const fileResult = useSelector(fileRequirementsCheckResult);
  const modResult = useSelector(modRequirementsCheckResult);
  const hiddenFile = useSelector(hiddenFileRequirements);
  const hiddenMod = useSelector(hiddenModRequirements);
  const showPremiumAd = useSelector(shouldShowPremiumAd);
  // The section whose install all is waiting on the premium modal.
  const [premiumInstallType, setPremiumInstallType] = useState<IssueType | undefined>();
  // The section whose install all is waiting on the author notes review.
  const [notesInstallType, setNotesInstallType] = useState<IssueType | undefined>();
  const isRefreshing = useSelector(isAnyHealthCheckRunning);
  // Every check that talks to Nexus Mods skips itself while logged out, so an empty
  // list then means "we couldn't run the checks", not "your loadout is healthy".
  const loggedIn = useSelector(isLoggedIn);

  // selectListedEntries / collectInstallAllItems read the slices above from the live
  // state; those slices fully determine their results. exhaustive-deps can't see the
  // getState() read, so it treats the slice deps as "unnecessary" (they are not).
  const items = useMemo(
    () => selectListedEntries(api.getState()),
    // eslint-disable-next-line @eslint-react/exhaustive-deps
    [api, fileResult, modResult, hiddenFile, hiddenMod],
  );
  const installAllItems = useMemo(
    () => collectInstallAllItems(api.getState(), api),
    // eslint-disable-next-line @eslint-react/exhaustive-deps
    [api, fileResult, modResult, hiddenFile, hiddenMod],
  );

  const activeItems = useMemo(() => items.filter((item) => !item.hidden), [items]);
  const hiddenItems = useMemo(() => items.filter((item) => item.hidden), [items]);
  const supportsHide = useMemo(() => items.some((item) => item.content.supportsHide), [items]);

  const toolbarActions = useMemo<IToolbarAction[]>(
    () => [
      {
        label: t("common:::refresh"),
        iconPath: mdiRefresh,
        isLoading: isRefreshing,
        onClick: () => onRefresh?.(),
      },
      {
        label: t("common:::settings"),
        iconPath: mdiCogOutline,
        onClick: () => {
          trackSettingsOpened();
          dispatch(setOpenMainPage("application_settings", false));
          dispatch(setSettingsPage("Vortex"));
        },
      },
    ],
    [dispatch, isRefreshing, onRefresh, t, trackSettingsOpened],
  );

  // page_viewed fires each time the page becomes active (it stays mounted across
  // navigation, so key off the active-prop transition rather than mount). lastHealthCheckRun
  // is read from state rather than subscribed, to avoid re-rendering the page on every scan.
  const wasActiveRef = useRef(false);

  useEffect(() => {
    if (active && !wasActiveRef.current) {
      const counts = countIssues(activeItems);

      trackPageViewed({
        active_issue_count: counts.total,
        hidden_issue_count: hiddenItems.length,
        warning_count: counts.warning,
        suggestion_count: counts.suggestion,
        last_scan_timestamp: lastHealthCheckRun(api.getState()),
      });
    }

    wasActiveRef.current = !!active;
  }, [active, activeItems, hiddenItems, trackPageViewed, api]);

  // passed_viewed fires when the success state becomes visible — on navigating to
  // an already-passed page, or when a scan clears the last active issue while viewing.
  // Logged out we show the "additional checks available" state instead, which isn't a
  // pass, so it must not count towards the pass rate.
  const passedShownRef = useRef(false);

  useEffect(() => {
    const passed = !!active && loggedIn && !activeItems.length;

    if (passed && !passedShownRef.current) {
      trackPassedViewed();
    }

    passedShownRef.current = passed;
  }, [active, activeItems, loggedIn, trackPassedViewed]);

  if (selected) {
    return (
      <HealthCheckDetailPage
        active={active}
        api={api}
        content={selected.content}
        entry={selected.entry}
        onBack={() => setSelected(null)}
      />
    );
  }

  const activeCount = activeItems.length;
  const hiddenCount = hiddenItems.length;
  // Without tabs the active list is all there is, and selectedTab stays on it.
  const listIsEmpty = selectedTab === "hidden" ? hiddenCount === 0 : activeCount === 0;

  const renderRow = (item: IListedEntry) => {
    const { content, entry } = item;

    return (
      <IssueProvider entry={entry} key={`${entry.checkId}:${entry.id}`}>
        <content.ListingRow
          api={api}
          entry={entry}
          isHidden={item.hidden}
          onOpen={() => setSelected(item)}
          onToggleHide={() => content.toggleHide?.(api, entry)}
        />
      </IssueProvider>
    );
  };

  const handleTabChange = (tab: string) => {
    if (tab !== selectedTab) {
      trackTabSwitched({
        tab: tab as HealthCheckTab,
        issue_count_in_tab: tab === "hidden" ? hiddenCount : activeCount,
      });
    }

    setSelectedTab(tab);
  };

  const hideAll = (issueType: IssueType, sectionItems: IListedEntry[]) => {
    trackHideAllClicked({ issue_type: issueType, issue_count_hidden: sectionItems.length });
    sectionItems.forEach((item) => item.content.toggleHide?.(api, item.entry));
  };

  const unhideAll = (issueType: IssueType, sectionItems: IListedEntry[]) => {
    trackUnhideAllClicked({ issue_type: issueType, issue_count_unhidden: sectionItems.length });
    sectionItems.forEach((item) => item.content.toggleHide?.(api, item.entry));
  };

  // 1-click install all: premium-gated for free users. Items are de-duplicated first by
  // collectInstallAllItems (by key) and again here at execution time via the seen set,
  // so a file shared across multiple source reports is only queued once.
  const runInstallAll = (items: IBulkInstallItem[]) => {
    const seen = new Set<string>();

    for (const item of items) {
      if (!seen.has(item.key)) {
        seen.add(item.key);
        item.install();
      }
    }
  };

  const installAll = (issueType: IssueType, issueCount: number) => {
    trackOneClickInstallAllClicked({
      issue_type: issueType,
      issue_count: issueCount,
      mod_count: installAllItems[issueType].length,
    });

    if (showPremiumAd) {
      setPremiumInstallType(issueType);
      return;
    }

    reviewThenInstall(issueType);
  };

  // Requirements with an author note are often optional, so they get a review first.
  const reviewThenInstall = (issueType: IssueType) => {
    if (installAllItems[issueType].some((item) => item.notedRequirement)) {
      setNotesInstallType(issueType);
      return;
    }

    runInstallAll(installAllItems[issueType]);
  };

  const renderSections = (tabItems: IListedEntry[], tab: HealthCheckTab) => (
    <div className="space-y-4">
      {groupByIssueType(tabItems).map(({ issueType, items: sectionItems }) => {
        const installCount = installAllItems[issueType].length;

        return (
          <IssueSection
            actions={
              <>
                {supportsHide && (
                  <Button
                    appearance="subdued"
                    brand="neutral"
                    leftIconPath={tab === "active" ? mdiEyeOffOutline : mdiEyeOutline}
                    size="sm"
                    onClick={() =>
                      tab === "active"
                        ? hideAll(issueType, sectionItems)
                        : unhideAll(issueType, sectionItems)
                    }
                  >
                    {t(tab === "active" ? "common:::hide_all" : "common:::unhide_all")}
                  </Button>
                )}

                {tab === "active" && !!installCount && (
                  <Button
                    brand="neutral"
                    leftIconPath={mdiMonitorArrowDownVariant}
                    rightIcon={showPremiumAd ? <PremiumBadge /> : undefined}
                    size="sm"
                    onClick={() => installAll(issueType, sectionItems.length)}
                  >
                    {t("actions::install_all", { count: installCount })}
                  </Button>
                )}
              </>
            }
            count={sectionItems.length}
            description={t(`listing::section::${issueType}::description`)}
            key={issueType}
            testId={`health-check-section-${issueType}`}
            title={t(`listing::section::${issueType}::title`)}
          >
            {sectionItems.map(renderRow)}
          </IssueSection>
        );
      })}
    </div>
  );

  // Logging in is a prerequisite for the Nexus-backed checks rather than a fix for an
  // issue, so it goes through the same OAuth flow as the header's profile button.
  const requestLogin = () => {
    dispatch(setDialogVisible("login-dialog"));

    api.events.emit("request-nexus-login", (err: Error) => {
      if (err != null && !(err instanceof UserCanceled)) {
        api.showErrorNotification?.("Login Failed", err, {
          id: "failed-get-nexus-key",
          allowReport: false,
        });
      }
    });
  };

  const loggedOutState = (
    <NoResults
      className="py-24"
      iconPath={mdiInformationOutline}
      message={t("listing::no_results_logged_out::message")}
      title={t("listing::no_results_logged_out::title")}
    >
      <Button data-testid="health-check-login" onClick={requestLogin}>
        {t("listing::no_results_logged_out::action")}
      </Button>
    </NoResults>
  );

  const passedState = (
    <NoResults
      appearance="success"
      className="py-24"
      iconPath={mdiCheckCircleOutline}
      message={t("listing::no_results_active::message")}
      title={t("listing::no_results_active::title")}
    />
  );

  const activeList = activeCount
    ? renderSections(activeItems, "active")
    : loggedIn
      ? passedState
      : loggedOutState;

  // The page's own events are cross-check aggregates, so it keeps the unscoped tracker
  // (it can't consume the context it provides). Everything below gets the ambient one;
  // the premium surfaces here sit outside any IssueProvider, which is what makes
  // them emit without issue_id / check_id.
  return (
    <HealthCheckTrackingProvider api={api}>
      <Page active={active} id="health-check-page" scrollable={false}>
        <PageHeader
          customTitle={(compact) => (
            <div className="flex items-center gap-x-1.5">
              <Typography
                appearance={compact ? "subdued" : "moderate"}
                as="h2"
                className="transition-colors"
                typographyType="heading-xs"
              >
                {t("listing::title")}
              </Typography>

              <BetaBadge isSubdued={compact} />
            </div>
          )}
          pictogramName="health-check"
          subtitle={t("listing::subtitle")}
        >
          <div className="flex shrink-0 items-center gap-x-2">
            <LastUpdated />

            <Toolbar>
              <ToolbarGroup actions={toolbarActions} />
            </Toolbar>
          </div>
        </PageHeader>

        <PageScroll className="space-y-6 p-6">
          {supportsHide ? (
            <TabProvider
              tab={selectedTab}
              tabListId="health-check-mods"
              tabType="secondary"
              onSetSelectedTab={handleTabChange}
            >
              <TabBar>
                <TabButton count={activeCount} name={t("common:::active")} panelId="active" />

                <TabButton count={hiddenCount} name={t("common:::hidden")} panelId="hidden" />
              </TabBar>

              <TabPanel id="active">{activeList}</TabPanel>

              <TabPanel id="hidden">
                {hiddenCount ? (
                  renderSections(hiddenItems, "hidden")
                ) : (
                  <NoResults
                    className="py-24"
                    iconPath={mdiEyeOffOutline}
                    title={t("listing::no_results_hidden::title")}
                  />
                )}
              </TabPanel>
            </TabProvider>
          ) : (
            activeList
          )}

          {!listIsEmpty && (
            <PremiumBanner api={api} placement="list" totalIssues={activeCount + hiddenCount} />
          )}

          <PremiumModal
            api={api}
            downloadScope="all"
            isOpen={premiumInstallType !== undefined}
            modCount={premiumInstallType ? installAllItems[premiumInstallType].length : 0}
            trigger="install_all"
            onClose={() => setPremiumInstallType(undefined)}
            onDownload={() => setPremiumInstallType(undefined)}
            onPremiumUnlocked={() => premiumInstallType && reviewThenInstall(premiumInstallType)}
          />

          <AuthorNotesModal
            isOpen={notesInstallType !== undefined}
            // Falls back while closing, so the list doesn't empty mid-transition.
            items={installAllItems[notesInstallType ?? "suggestion"]}
            onClose={() => setNotesInstallType(undefined)}
            onInstall={(items) => {
              setNotesInstallType(undefined);
              runInstallAll(items);
            }}
          />
        </PageScroll>
      </Page>
    </HealthCheckTrackingProvider>
  );
};

export default HealthCheckPage;
