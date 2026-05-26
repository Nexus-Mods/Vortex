import { mdiCheckCircle, mdiCog, mdiDownload, mdiEye, mdiEyeOff, mdiRefresh } from "@mdi/js";
import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";

import { setOpenMainPage, setSettingsPage } from "@/actions/session";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { NoResults } from "@/ui/components/no_results/NoResults";
import { Pictogram } from "@/ui/components/pictogram/Pictogram";
import { PremiumBadge } from "@/ui/components/premium_badge/PremiumBadge";
import { TabButton } from "@/ui/components/tabs/Tab";
import { TabBar } from "@/ui/components/tabs/TabBar";
import { TabPanel } from "@/ui/components/tabs/TabPanel";
import { TabProvider } from "@/ui/components/tabs/tabs.context";
import { Typography } from "@/ui/components/typography/Typography";
import { shouldShowPremiumAd } from "@/util/selectors";
import { batchDispatch } from "@/util/util";
import MainPage from "@/views/MainPage";

import { setRequirementHidden, clearAllHiddenRequirements } from "../actions/persistent";
import { ModRequirement } from "../components/mod_requirement/ModRequirement";
import { PremiumBanner } from "../components/premium_banner/PremiumBanner";
import { hiddenRequirements, allModRequirements } from "../selectors";
import type { IModFileInfo, IModRequirementExt } from "../types";
import HealthCheckDetailPage from "./HealthCheckDetailPage";

interface IHealthCheckPageProps {
  api: IExtensionApi;
  onRefresh?: () => void;
  onDownloadRequirement?: (mod: IModRequirementExt, file?: IModFileInfo) => Promise<void>;
}

function HealthCheckPage({ api, onRefresh, onDownloadRequirement }: IHealthCheckPageProps) {
  const { t } = useTranslation(["health_check", "common"]);
  const dispatch = useDispatch();
  const [showDetail, setShowDetail] = useState(false);
  const [selectedTab, setSelectedTab] = useState("active");
  const [selectedRequirement, setSelectedRequirement] = useState<IModRequirementExt | null>(null);

  const showPremiumAd = useSelector(shouldShowPremiumAd);
  const modRequirements: IModRequirementExt[] = useSelector(allModRequirements);
  const hiddenReqsMap = useSelector(hiddenRequirements);

  const isModRequirementHidden = useCallback(
    (mod: IModRequirementExt): boolean => {
      const hiddenReqs = hiddenReqsMap[mod.requiredBy.modId] || [];
      return hiddenReqs.includes(mod.id);
    },
    [hiddenReqsMap],
  );

  // Filter active and hidden mods
  const activeMods = useMemo(
    () => modRequirements.filter((mod) => !isModRequirementHidden(mod)),
    [modRequirements, isModRequirementHidden],
  );

  const hiddenMods = useMemo(
    () => modRequirements.filter((mod) => isModRequirementHidden(mod)),
    [modRequirements, isModRequirementHidden],
  );

  const toggleHideMod = (mod: IModRequirementExt) => {
    const isHidden = isModRequirementHidden(mod);
    if (isHidden) {
      // Unhide: clear all hidden dependencies for this mod
      dispatch(setRequirementHidden(mod.requiredBy.modId, mod.id, false));
    } else {
      dispatch(setRequirementHidden(mod.requiredBy.modId, mod.id, true));
    }
  };

  const hideAllActive = () => {
    const batched = [];
    activeMods.forEach((mod) => {
      batched.push(setRequirementHidden(mod.requiredBy.modId, mod.id, true));
    });
    batchDispatch(dispatch, batched);
  };

  const unhideAll = () => {
    dispatch(clearAllHiddenRequirements(undefined));
  };

  if (showDetail && selectedRequirement) {
    return (
      <HealthCheckDetailPage
        api={api}
        mod={selectedRequirement}
        onBack={() => {
          setShowDetail(false);
          setSelectedRequirement(null);
        }}
        onDownloadMod={(mod, file) => onDownloadRequirement?.(mod, file)}
      />
    );
  }

  const activeCount = activeMods.length;
  const hiddenCount = hiddenMods.length;

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
                brand="neutral"
                appearance="subdued"
                leftIconPath={mdiRefresh}
                size="sm"
                title={t("common:::refresh")}
                onClick={() => onRefresh?.()}
              />

              <Button
                brand="neutral"
                appearance="subdued"
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

          <TabProvider
            tab={selectedTab}
            tabListId="health-check-mods"
            tabType="secondary"
            onSetSelectedTab={setSelectedTab}
          >
            <div className="flex items-center justify-between">
              <TabBar>
                <TabButton count={activeMods.length} name={t("common:::active")} />

                <TabButton count={hiddenMods.length} name={t("common:::hidden")} />
              </TabBar>

              <div className="flex gap-x-2">
                <Button
                  brand="neutral"
                  appearance="subdued"
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

                {/* todo only show this divider and button when there is more than 1 Quick install, not including OR’s */}
                <div className="w-px bg-stroke-weak" />

                <Button
                  brand="neutral"
                  appearance="strong"
                  leftIconPath={mdiDownload}
                  rightIcon={showPremiumAd && <PremiumBadge />}
                  size="sm"
                  onClick={() => console.log("todo")}
                >
                  {t("actions::install_all", { count: 4 })}
                </Button>
              </div>
            </div>

            <TabPanel name="active">
              {!activeCount ? (
                <NoResults
                  appearance="success"
                  className="py-24"
                  iconPath={mdiCheckCircle}
                  message={t("listing::no_results_active::message")}
                  title={t("listing::no_results_active::title")}
                />
              ) : (
                <div className="space-y-2">
                  {activeMods.map((mod) => (
                    <ModRequirement
                      key={`${mod.requiredBy.modId}-${mod.uid || `${mod.gameId}-${mod.modId || mod.modName}`}`}
                      requirementInfo={mod}
                      onClick={() => {
                        setSelectedRequirement(mod);
                        setShowDetail(true);
                      }}
                      onToggleHide={() => toggleHideMod(mod)}
                    />
                  ))}
                </div>
              )}
            </TabPanel>

            <TabPanel name="hidden">
              {!hiddenCount ? (
                <NoResults
                  className="py-24"
                  iconPath={mdiEyeOff}
                  title={t("listing::no_results_hidden::title")}
                />
              ) : (
                <div className="space-y-2">
                  {hiddenMods.map((mod) => (
                    <ModRequirement
                      isHidden={true}
                      key={`${mod.requiredBy.modId}-${mod.uid || `${mod.gameId}-${mod.modId || mod.modName}`}`}
                      requirementInfo={mod}
                      onClick={() => {
                        setSelectedRequirement(mod);
                        setShowDetail(true);
                      }}
                      onToggleHide={() => toggleHideMod(mod)}
                    />
                  ))}
                </div>
              )}
            </TabPanel>
          </TabProvider>

          <PremiumBanner />
        </div>
      </MainPage.Body>
    </MainPage>
  );
}

export default HealthCheckPage;
