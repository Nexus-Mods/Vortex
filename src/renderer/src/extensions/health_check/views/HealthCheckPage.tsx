import { mdiCheckCircle, mdiCog, mdiEye, mdiEyeOff, mdiRefresh } from "@mdi/js";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { setOpenMainPage, setSettingsPage } from "@/actions/session";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { NoResults } from "@/ui/components/no_results/NoResults";
import { Pictogram } from "@/ui/components/pictogram/Pictogram";
import { TabBar } from "@/ui/components/tabs/TabBar";
import { TabButton } from "@/ui/components/tabs/TabButton";
import { TabPanel } from "@/ui/components/tabs/TabPanel";
import { TabProvider } from "@/ui/components/tabs/Tabs.context";
import { Typography } from "@/ui/components/typography/Typography";
import MainPage from "@/views/MainPage";

import { PremiumBanner } from "../components/premium_banner/PremiumBanner";
import { healthCheckContent } from "./content/registry";
import type { IHealthCheckContent, IHealthCheckEntry } from "./content/types";
import HealthCheckDetailPage from "./HealthCheckDetailPage";

interface IHealthCheckPageProps {
  api: IExtensionApi;
  onRefresh?: () => void;
}

interface IListedEntry {
  entry: IHealthCheckEntry;
  content: IHealthCheckContent;
  hidden: boolean;
}

/** Gather entries from every registered health-check content provider. */
function selectListedEntries(state: IState): IListedEntry[] {
  const items: IListedEntry[] = [];
  for (const content of Object.values(healthCheckContent)) {
    if (!content) {
      continue;
    }
    for (const entry of content.selectEntries(state)) {
      items.push({ entry, content, hidden: content.isHidden?.(state, entry) ?? false });
    }
  }
  return items;
}

function HealthCheckPage({ api, onRefresh }: IHealthCheckPageProps) {
  const { t } = useTranslation(["health_check", "common"]);
  const dispatch = useDispatch();
  const [selected, setSelected] = useState<IListedEntry | null>(null);
  const [selectedTab, setSelectedTab] = useState("active");

  const items = useSelector(selectListedEntries);

  const activeItems = useMemo(() => items.filter((item) => !item.hidden), [items]);
  const hiddenItems = useMemo(() => items.filter((item) => item.hidden), [items]);
  const supportsHide = useMemo(() => items.some((item) => item.content.supportsHide), [items]);

  if (selected) {
    return (
      <HealthCheckDetailPage
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
    <MainPage id="health-check-page">
      <MainPage.Body>
        <div className="h-full space-y-6 overflow-y-auto p-6">
          <div className="flex items-center gap-x-6">
            <div className="flex grow items-center gap-x-2">
              <Pictogram name="health-check" size="sm" />

              <div className="grow">
                <div className="flex items-center gap-x-1.5">
                  <Typography as="h2" typographyType="heading-xs">
                    {t("listing::title")}
                  </Typography>

                  <Typography
                    as="div"
                    className="justity-center flex min-h-4 items-center rounded-sm border border-neutral-strong px-1 leading-4"
                    typographyType="title-xs"
                  >
                    {t("common:::beta")}
                  </Typography>
                </div>

                <Typography appearance="moderate">{t("listing::subtitle")}</Typography>
              </div>
            </div>

            <div className="flex shrink-0 gap-x-2">
              <Button
                appearance="subdued"
                brand="neutral"
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
          </div>

          {supportsHide ? (
            <TabProvider
              tab={selectedTab}
              tabListId="health-check-mods"
              tabType="secondary"
              onSetSelectedTab={setSelectedTab}
            >
              <div className="flex items-center justify-between">
                <TabBar>
                  <TabButton count={activeCount} name={t("common:::active")} />

                  <TabButton count={hiddenCount} name={t("common:::hidden")} />
                </TabBar>

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
              </div>

              <TabPanel name="active">{activeList}</TabPanel>

              <TabPanel name="hidden">
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
        </div>
      </MainPage.Body>
    </MainPage>
  );
}

export default HealthCheckPage;
