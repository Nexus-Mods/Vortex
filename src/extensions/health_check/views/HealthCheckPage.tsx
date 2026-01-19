import * as React from "react";
import { useTranslation } from "react-i18next";

import MainPage from "../../../renderer/views/MainPage";
import { Button } from "../../../tailwind/components/next/button";
import { Icon } from "../../../tailwind/components/next/icon";
import { Typography } from "../../../tailwind/components/next/typography";
import HealthCheckDetailPage from "./HealthCheckDetailPage";
import { Pictogram } from "../../../tailwind/components/pictogram";

interface HealthCheckItemProps {
  modName: string;
  onClick: () => void;
}

const Mod = ({ modName, onClick }: HealthCheckItemProps) => {
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
          {t("listing::item::description")}
        </Typography>
      </div>

      <Button
        buttonType="tertiary"
        filled="weak"
        leftIconPath="mdiEyeOff"
        size="sm"
        title={t("common:::hide")}
      />

      <Icon
        className="text-translucent-moderate shrink-0"
        path="mdiChevronRight"
        size="lg"
      />
    </div>
  );
};

function HealthCheckPage() {
  const { t } = useTranslation(["health_check", "common"]);
  const [showDetail, setShowDetail] = React.useState(false);

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

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-x-1.5">
              <button>{t("common:::active")}</button>

              <button>{t("common:::hidden")} (0)</button>
            </div>

            <Button
              buttonType="tertiary"
              filled="weak"
              leftIconPath="mdiEyeOff"
              size="sm"
            >
              {t("common:::hide_all")}
            </Button>
          </div>

          <div className="space-y-2">
            <Mod
              modName="Sprint Swim Redux SKSE"
              onClick={() => setShowDetail(true)}
            />

            <Mod modName="SkyUI" onClick={() => setShowDetail(true)} />
          </div>
        </div>
      </MainPage.Body>
    </MainPage>
  );
}

export default HealthCheckPage;
