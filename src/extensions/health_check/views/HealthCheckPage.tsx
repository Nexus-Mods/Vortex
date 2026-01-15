import * as React from "react";
import { useTranslation } from "react-i18next";

import MainPage from "../../../renderer/views/MainPage";
import { Button } from "../../../tailwind/components/next/button";
import { Icon } from "../../../tailwind/components/next/icon";
import { Typography } from "../../../tailwind/components/next/typography";
import HealthCheckDetailPage from "./HealthCheckDetailPage";

interface HealthCheckItemProps {
  modName: string;
  onClick: () => void;
}

const HealthCheckItem = ({ modName, onClick }: HealthCheckItemProps) => {
  const { t } = useTranslation("health_check");

  return (
    <button
      className="w-full hover-overlay flex items-center rounded bg-surface-mid py-3 px-4 gap-x-4 shadow-xs"
      onClick={onClick}
    >
      <Icon className="text-info-strong shrink-0" path="mdiAlertCircle" />

      <div className="grow space-y-0.5 text-left">
        <Typography>{t("listing::item::title", { modName })}</Typography>

        <Typography appearance="subdued" typographyType="body-sm">
          {t("listing::item::description")}
        </Typography>
      </div>

      <Icon
        className="text-translucent-moderate shrink-0"
        path="mdiChevronRight"
        size="lg"
      />
    </button>
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
        <div className="p-6">
          <div className="flex justify-between items-center gap-x-6 mb-4">
            <div>
              <div className="flex items-center gap-x-1.5">
                <Typography as="h2" className="m-0" typographyType="heading-sm">
                  {t("listing::title")}
                </Typography>

                <Typography
                  as="div"
                  appearance="none"
                  className="leading-4 rounded border border-info-moderate flex items-center justity-center px-1 min-h-4 text-info-strong"
                  typographyType="title-xs"
                >
                  {t("common:::beta")}
                </Typography>
              </div>

              <Typography>{t("listing::subtitle")}</Typography>
            </div>

            <div>
              <Button
                buttonType="tertiary"
                filled="weak"
                leftIconPath="mdiRefresh"
                size="sm"
              >
                {t("common:::refresh")}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <HealthCheckItem
              modName="Sprint Swim Redux SKSE"
              onClick={() => setShowDetail(true)}
            />

            <HealthCheckItem
              modName="SkyUI"
              onClick={() => setShowDetail(true)}
            />
          </div>
        </div>
      </MainPage.Body>
    </MainPage>
  );
}

export default HealthCheckPage;
