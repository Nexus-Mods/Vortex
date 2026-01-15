import * as React from "react";
import { Trans, useTranslation } from "react-i18next";

import MainPage from "../../../renderer/views/MainPage";
import { Button } from "../../../tailwind/components/next/button";
import { Typography } from "../../../tailwind/components/next/typography";
import { Icon } from "../../../tailwind/components/next/icon";

function HealthCheckDetailPage({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation(["health_check", "common"]);

  return (
    <MainPage id="health-check-detail-page">
      <MainPage.Body>
        <div className="p-6">
          <div className="flex justify-between items-center gap-x-6 mb-6">
            <div>
              <div className="flex items-center gap-x-1.5">
                <Typography as="h2" className="m-0" typographyType="heading-sm">
                  <Trans
                    i18nKey="detail::title"
                    ns="health_check"
                    components={{
                      highlight: <span className="text-info-strong" />,
                    }}
                  />
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

              <Typography>{t("detail::subtitle")}</Typography>
            </div>

            <div>
              <Button
                buttonType="tertiary"
                filled="weak"
                leftIconPath="mdiArrowLeft"
                size="sm"
                onClick={onBack}
              >
                {t("common:::view_all")}
              </Button>
            </div>
          </div>

          <div className="bg-surface-mid p-6 rounded-lg">
            <div className="flex items-start gap-x-3 mb-6">
              <Icon
                className="mt-0.5 text-info-strong shrink-0"
                path="mdiAlertCircle"
              />

              <div className="grow space-y-0.5 text-left">
                <Typography>
                  {t("detail::item::title", {
                    modName: "Sprint Swim Redux SKSE or Longer mod name",
                  })}
                </Typography>

                <Typography appearance="moderate" isTranslucent={true}>
                  {t("detail::item::description")}
                </Typography>
              </div>

              <div className="flex gap-x-2 shrink-0">
                <Button
                  buttonType="tertiary"
                  leftIconPath="mdiThumbUp"
                  size="xs"
                  title="Helpful"
                />

                <Button
                  buttonType="tertiary"
                  leftIconPath="mdiThumbDown"
                  size="xs"
                  title="Not helpful"
                />

                <Button
                  buttonType="tertiary"
                  leftIconPath="mdiEyeOff"
                  size="xs"
                >
                  {t("common:::ignore")}
                </Button>
              </div>
            </div>

            <div className="border border-stroke-weak rounded-lg p-6">
              Content
            </div>
          </div>
        </div>
      </MainPage.Body>
    </MainPage>
  );
}

export default HealthCheckDetailPage;
