import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import MainPage from "../../../renderer/views/MainPage";
import { Button } from "../../../tailwind/components/next/button";
import { Icon } from "../../../tailwind/components/next/icon";
import { Typography } from "../../../tailwind/components/next/typography";
import HealthCheckDetailPage from "./HealthCheckDetailPage";
import { Pictogram } from "../../../tailwind/components/pictogram";
import {
  TabBar,
  TabButton,
  TabPanel,
  TabProvider,
} from "../../../tailwind/components/next/tabs";

import { NoResults } from "../../../tailwind/components/no_results";
import { useSelector, useDispatch } from "react-redux";
import { hiddenRequirements, modRequirementsArray } from "../selectors";
import {
  setRequirementHidden,
  clearAllHiddenRequirements,
} from "../actions/persistent";
import type { IModRequirementExt } from "../types";
import { batchDispatch } from "../../../util/util";

const Mod = ({
  isHidden,
  onClick,
  onToggleHide,
  requirementInfo,
}: {
  isHidden?: boolean;
  requirementInfo: IModRequirementExt;
  onClick: () => void;
  onToggleHide?: (e: React.MouseEvent) => void;
}) => {
  const { t } = useTranslation("health_check");

  return (
    <div
      className="w-full hover-overlay-weak flex items-center rounded bg-surface-mid py-3 px-4 gap-x-4 shadow-xs"
      onClick={onClick}
    >
      <Icon className="text-info-strong shrink-0" path="mdiAlertCircle" />

      <div className="grow space-y-0.5 text-left">
        <Typography>
          {t("listing::item::title", {
            modName: requirementInfo.requiredBy.modName,
          })}
        </Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          {t("listing::item::description", {
            dependencyModName: requirementInfo.modName,
          })}
        </Typography>
      </div>

      <Button
        as="button"
        buttonType="tertiary"
        filled="weak"
        leftIconPath={isHidden ? "mdiEye" : "mdiEyeOff"}
        size="sm"
        title={isHidden ? t("common:::unhide") : t("common:::hide")}
        onClick={(e) => {
          e.stopPropagation();
          onToggleHide?.(e);
        }}
      />

      <Icon
        className="text-translucent-moderate shrink-0"
        path="mdiChevronRight"
        size="lg"
      />
    </div>
  );
};

interface IHealthCheckPageProps {
  onRefresh?: () => void;
  onDownloadRequirements?: (modIds: number[]) => void;
}

function HealthCheckPage({
  onRefresh,
  onDownloadRequirements,
}: IHealthCheckPageProps) {
  const { t } = useTranslation(["health_check", "common"]);
  const dispatch = useDispatch();
  const [showDetail, setShowDetail] = useState(false);
  const [selectedTab, setSelectedTab] = useState("active");
  const [selectedRequirement, setSelectedRequirement] =
    useState<IModRequirementExt | null>(null);

  const modRequirements: IModRequirementExt[] =
    useSelector(modRequirementsArray);

  const hiddenReqsMap = useSelector(hiddenRequirements);

  const isModRequirementHidden = React.useCallback(
    (mod: IModRequirementExt): boolean => {
      const hiddenReqs = hiddenReqsMap[mod.requiredBy.modId] || [];
      return hiddenReqs.includes(mod.modId);
    },
    [hiddenReqsMap],
  );

  // Filter active and hidden mods
  const activeMods = React.useMemo(
    () => modRequirements.filter((mod) => !isModRequirementHidden(mod)),
    [modRequirements, isModRequirementHidden],
  );

  const hiddenMods = React.useMemo(
    () => modRequirements.filter((mod) => isModRequirementHidden(mod)),
    [modRequirements, isModRequirementHidden],
  );

  const toggleHideMod = (mod: IModRequirementExt) => {
    const isHidden = isModRequirementHidden(mod);
    if (isHidden) {
      // Unhide: clear all hidden dependencies for this mod
      dispatch(setRequirementHidden(mod.requiredBy.modId, mod.modId, false));
    } else {
      dispatch(setRequirementHidden(mod.requiredBy.modId, mod.modId, true));
    }
  };

  const hideAllActive = () => {
    const batched = [];
    activeMods.forEach((mod) => {
      batched.push(setRequirementHidden(mod.requiredBy.modId, mod.modId, true));
    });
    batchDispatch(dispatch, batched);
  };

  const unhideAll = () => {
    dispatch(clearAllHiddenRequirements(undefined));
  };

  if (showDetail && selectedRequirement) {
    return (
      <HealthCheckDetailPage
        mod={selectedRequirement}
        onBack={() => {
          setShowDetail(false);
          setSelectedRequirement(null);
        }}
      />
    );
  }

  const activeCount = activeMods.length;
  const hiddenCount = hiddenMods.length;

  return (
    <MainPage id="health-check-page">
      <MainPage.Body>
        <div className="p-6 space-y-4 max-w-5xl">
          <div className="flex items-center gap-x-6">
            <div className="grow flex gap-x-2 items-center">
              <Pictogram name="health-check" size="sm" />

              <div className="grow">
                <div className="flex items-center gap-x-1.5">
                  <Typography
                    as="h2"
                    className="m-0"
                    typographyType="heading-xs"
                  >
                    {t("listing::title")}
                  </Typography>

                  <Typography
                    as="div"
                    className="leading-4 rounded border border-neutral-strong flex items-center justity-center px-1 min-h-4"
                    typographyType="title-xs"
                  >
                    {t("common:::beta")}
                  </Typography>
                </div>

                <Typography appearance="moderate">
                  {t("listing::subtitle")}
                </Typography>
              </div>
            </div>

            <div className="flex gap-x-2 shrink-0">
              <Button
                buttonType="tertiary"
                filled="weak"
                leftIconPath="mdiRefresh"
                size="sm"
                title={t("common:::refresh")}
                onClick={() => onRefresh?.()}
              />

              <Button
                buttonType="tertiary"
                filled="weak"
                leftIconPath="mdiCog"
                size="sm"
                title={t("common:::settings")}
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
                <TabButton
                  count={activeMods.length}
                  name={t("common:::active")}
                />
                <TabButton
                  count={hiddenMods.length}
                  name={t("common:::hidden")}
                />
              </TabBar>

              <Button
                buttonType="tertiary"
                disabled={
                  (selectedTab === "active" && !activeCount) ||
                  (selectedTab === "hidden" && !hiddenCount)
                }
                filled="weak"
                leftIconPath={selectedTab === "active" ? "mdiEyeOff" : "mdiEye"}
                size="sm"
                onClick={selectedTab === "active" ? hideAllActive : unhideAll}
              >
                {selectedTab === "active"
                  ? `${t("common:::hide_all")}${activeCount ? ` (${activeCount})` : ""}`
                  : `${t("common:::unhide_all")}${hiddenCount ? ` (${hiddenCount})` : ""}`}
              </Button>
            </div>

            <TabPanel name="active">
              {!activeCount ? (
                <NoResults
                  appearance="success"
                  className="py-24"
                  iconPath="mdiCheckCircle"
                  message={t("listing::no_results_active::message")}
                  title={t("listing::no_results_active::title")}
                />
              ) : (
                <div className="space-y-2">
                  {activeMods.map((mod) => (
                    <Mod
                      key={`${mod.requiredBy.modId}-${mod.modId}`}
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
                  iconPath="mdiEyeOff"
                  title={t("listing::no_results_hidden::title")}
                />
              ) : (
                <div className="space-y-2">
                  {hiddenMods.map((mod) => (
                    <Mod
                      key={`${mod.requiredBy.modId}-${mod.modId}`}
                      isHidden={true}
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
        </div>
      </MainPage.Body>
    </MainPage>
  );
}

export default HealthCheckPage;
