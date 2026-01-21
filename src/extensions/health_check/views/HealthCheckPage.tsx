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
import { useSelector } from "react-redux";
import { modRequirementsCheckResult } from "../selectors";

const Mod = ({
  dependencyModName,
  isHidden,
  modName,
  onClick,
}: {
  dependencyModName: string;
  isHidden?: boolean;
  modName: string;
  onClick: () => void;
}) => {
  const { t } = useTranslation("health_check");

  return (
    <div
      className="w-full hover-overlay-weak flex items-center rounded bg-surface-mid py-3 px-4 gap-x-4 shadow-xs"
      onClick={onClick}
    >
      <Icon className="text-info-strong shrink-0" path="mdiAlertCircle" />

      <div className="grow space-y-0.5 text-left">
        <Typography>{t("listing::item::title", { modName })}</Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          {t("listing::item::description", { dependencyModName })}
        </Typography>
      </div>

      <Button
        buttonType="tertiary"
        filled="weak"
        leftIconPath={isHidden ? "mdiEye" : "mdiEyeOff"}
        size="sm"
        title={isHidden ? t("common:::unhide") : t("common:::hide")}
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
  const [showDetail, setShowDetail] = useState(false);
  const [selectedTab, setSelectedTab] = useState("active");

  const modRequirements = useSelector(modRequirementsCheckResult);

  if (showDetail) {
    return <HealthCheckDetailPage onBack={() => setShowDetail(false)} />;
  }

  return (
    <MainPage id="health-check-page">
      <MainPage.Body>
        <div className="p-6 space-y-4">
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
                <TabButton count={3} name={t("common:::active")} />
                <TabButton count={1} name={t("common:::hidden")} />
              </TabBar>

              <Button
                buttonType="tertiary"
                filled="weak"
                leftIconPath={selectedTab === "active" ? "mdiEyeOff" : "mdiEye"}
                size="sm"
              >
                {selectedTab === "active"
                  ? `${t("common:::hide_all")} (3)`
                  : `${t("common:::unhide_all")} (1)`}
              </Button>
            </div>

            <TabPanel name="active">
              <div className="space-y-2">
                <Mod
                  dependencyModName="Apothecary - An Alchemy Overhaul"
                  modName="Apothecary - Lighter Potions and Poisons"
                  onClick={() => setShowDetail(true)}
                />

                <Mod
                  dependencyModName="Address Library for SKSE Plugins"
                  modName="Better Jumping - Stamina Cost"
                  onClick={() => setShowDetail(true)}
                />
              </div>
            </TabPanel>

            <TabPanel name="hidden">
              <div className="space-y-2">
                <Mod
                  dependencyModName="Address Library for SKSE Plugins"
                  isHidden={true}
                  modName="Better Jumping - Stamina Cost"
                  onClick={() => setShowDetail(true)}
                />
              </div>
            </TabPanel>
          </TabProvider>
        </div>
      </MainPage.Body>
    </MainPage>
  );
}

export default HealthCheckPage;
