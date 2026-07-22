import {
  mdiCheckCircle,
  mdiCog,
  mdiMonitorArrowDownVariant,
  mdiEye,
  mdiEyeOff,
  mdiRefresh,
} from "@mdi/js";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { setOpenMainPage, setSettingsPage } from "@/actions/session";
import { DisplayOptions } from "@/extensions/gamemode_management/components/DisplayOptions";
import { Search } from "@/extensions/gamemode_management/components/Search";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { NoResults } from "@/ui/components/no_results/NoResults";
import { Pictogram } from "@/ui/components/pictogram/Pictogram";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";
import { TabBar } from "@/ui/components/tabs/TabBar";
import { TabButton } from "@/ui/components/tabs/TabButton";
import { TabPanel } from "@/ui/components/tabs/TabPanel";
import { TabProvider } from "@/ui/components/tabs/Tabs.context";
import { Typography } from "@/ui/components/typography/Typography";
import { useRelativeTime } from "@/util/useRelativeTime";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";
import { PageScroll } from "@/views/components/Page/PageScroll";

import { shouldShowPremiumAd } from "../../nexus_integration/selectors";
import { PremiumBanner } from "../components/premium_banner/PremiumBanner";
import { PremiumModal } from "../components/premium_modal/PremiumModal";
import {
  fileRequirementsCheckResult,
  hiddenFileRequirements,
  hiddenModRequirements,
  isAnyHealthCheckRunning,
  lastHealthCheckRun,
  modRequirementsCheckResult,
} from "../selectors";
import { type IListedEntry, selectListedEntries } from "../utils/shared/listedEntries";
import { healthCheckContent } from "./content/registry";
import type { IBulkInstallItem } from "./content/types";
import HealthCheckDetailPage from "./HealthCheckDetailPage";

interface IHealthCheckPageProps {
  api: IExtensionApi;
  onRefresh?: () => void;
  active?: boolean;
}

/**
 * "Last updated" header label. Leaf component: its periodic age tick and
 * per-result lastFullRun subscription re-render only this label. Renders
 * nothing until the first check run of the session.
 */
function LastUpdated() {
  const { t } = useTranslation(["health_check", "common"]);
  const lastRun = useSelector(lastHealthCheckRun);
  const time = useRelativeTime(lastRun, t);
  if (time === undefined) {
    return null;
  }
  return (
    <Typography appearance="moderate" typographyType="body-sm">
      {t("listing::last_updated", { time })}
    </Typography>
  );
}

/** No-choice install items from every check, de-duplicated across checks by key. */
function collectInstallAllItems(state: IState, api: IExtensionApi): IBulkInstallItem[] {
  const seen = new Set<string>();
  const out: IBulkInstallItem[] = [];
  for (const content of Object.values(healthCheckContent)) {
    for (const item of content?.collectInstallAll?.(state, api) ?? []) {
      if (!seen.has(item.key)) {
        seen.add(item.key);
        out.push(item);
      }
    }
  }
  return out;
}

function HealthCheckPage({ api, onRefresh, active }: IHealthCheckPageProps) {
  const { t } = useTranslation(["health_check", "common"]);
  const dispatch = useDispatch();
  const [selected, setSelected] = useState<IListedEntry | null>(null);
  const [selectedTab, setSelectedTab] = useState("active");

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
  const [showInstallAllPremium, setShowInstallAllPremium] = useState(false);
  const isRefreshing = useSelector(isAnyHealthCheckRunning);

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

  const renderRow = (item: IListedEntry) => {
    const { content, entry } = item;
    return (
      <content.ListingRow
        api={api}
        entry={entry}
        isHidden={item.hidden}
        key={`${entry.checkId}:${entry.id}`}
        onOpen={() => setSelected(item)}
        onToggleHide={() => content.toggleHide?.(api, entry)}
      />
    );
  };

  const hideAllActive = () => {
    activeItems.forEach((item) => item.content.toggleHide?.(api, item.entry));
  };

  const unhideAll = () => {
    hiddenItems.forEach((item) => item.content.toggleHide?.(api, item.entry));
  };

  // 1-click install all: premium-gated for free users. Items are de-duplicated first by
  // collectInstallAllItems (by key) and again here at execution time via the seen set,
  // so a file shared across multiple source reports is only queued once.
  const installAll = () => {
    if (showPremiumAd) {
      setShowInstallAllPremium(true);
      return;
    }
    const seen = new Set<string>();
    for (const item of installAllItems) {
      if (!seen.has(item.key)) {
        seen.add(item.key);
        item.install();
      }
    }
  };

  const activeList =
    activeCount > 0 ? (
      <div className="space-y-2">{activeItems.map(renderRow)}</div>
    ) : (
      <NoResults
        appearance="success"
        className="py-24"
        iconPath={mdiCheckCircle}
        message={t("listing::no_results_active::message")}
        title={t("listing::no_results_active::title")}
      />
    );

  return (
    <Page active={active} id="health-check-page" scrollable={false}>
      <PageHeader
        pictogramName="health-check"
        subtitle={t("listing::subtitle")}
        title={t("listing::title")}
      >
        <div className="flex shrink-0 items-center gap-x-2">
          <LastUpdated />

          <Button
            appearance="subdued"
            brand="neutral"
            isLoading={isRefreshing}
            leftIconPath={mdiRefresh}
            size="sm"
            title={t("common:::refresh")}
            onClick={() => onRefresh?.()}
          />

          <Button
            appearance="subdued"
            brand="neutral"
            leftIconPath={mdiCog}
            size="sm"
            title={t("common:::settings")}
            onClick={() => {
              dispatch(setOpenMainPage("application_settings", false));
              dispatch(setSettingsPage("Vortex"));
            }}
          />
        </div>
      </PageHeader>

      <PageScroll className="space-y-6 p-6">
        {supportsHide ? (
          <TabProvider
            tab={selectedTab}
            tabListId="health-check-mods"
            tabType="secondary"
            onSetSelectedTab={setSelectedTab}
          >
            <div className="flex items-center justify-between">
              <TabBar>
                <TabButton count={activeCount} name={t("common:::active")} panelId="active" />

                <TabButton count={hiddenCount} name={t("common:::hidden")} panelId="hidden" />
              </TabBar>

              <div className="flex items-center gap-x-2">
                <Button
                  appearance="subdued"
                  brand="neutral"
                  disabled={
                    (selectedTab === "active" && !activeCount) ||
                    (selectedTab === "hidden" && !hiddenCount)
                  }
                  leftIconPath={selectedTab === "active" ? mdiEyeOff : mdiEye}
                  size="sm"
                  onClick={selectedTab === "active" ? hideAllActive : unhideAll}
                >
                  {selectedTab === "active"
                    ? `${t("common:::hide_all")}${activeCount ? ` (${activeCount})` : ""}`
                    : `${t("common:::unhide_all")}${hiddenCount ? ` (${hiddenCount})` : ""}`}
                </Button>

                {selectedTab === "active" && installAllItems.length > 0 && (
                  <>
                    <div className="w-px self-stretch bg-stroke-weak" />

                    <Button
                      brand="neutral"
                      leftIconPath={mdiMonitorArrowDownVariant}
                      rightIcon={showPremiumAd ? <PremiumBadge /> : undefined}
                      size="sm"
                      onClick={installAll}
                    >
                      {t("actions::install_all", { count: installAllItems.length })}
                    </Button>
                  </>
                )}
              </div>
            </div>

            <TabPanel id="active">{activeList}</TabPanel>

            <TabPanel id="hidden">
              {hiddenCount > 0 ? (
                <div className="space-y-2">{hiddenItems.map(renderRow)}</div>
              ) : (
                <NoResults
                  className="py-24"
                  iconPath={mdiEyeOff}
                  title={t("listing::no_results_hidden::title")}
                />
              )}
            </TabPanel>
          </TabProvider>
        ) : (
          activeList
        )}

        <PremiumBanner />

        <PremiumModal
          downloadScope="all"
          isOpen={showInstallAllPremium}
          onClose={() => setShowInstallAllPremium(false)}
          onDownload={() => setShowInstallAllPremium(false)}
        />
      </PageScroll>
    </Page>
  );
}

export default HealthCheckPage;
