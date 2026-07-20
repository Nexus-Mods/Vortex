import { mdiArrowLeft } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { Pictogram } from "@/ui/components/pictogram/Pictogram";
import { Typography } from "@/ui/components/typography/Typography";
import MainPage from "@/views/MainPage";

import { PremiumBanner } from "../components/premium_banner/PremiumBanner";
import type { IHealthCheckContent, IHealthCheckEntry } from "./content/types";

interface IHealthCheckDetailPageProps {
  api: IExtensionApi;
  content: IHealthCheckContent;
  entry: IHealthCheckEntry;
  onBack: () => void;
}

/**
 * Shared detail chrome: header (severity title/subtitle, beta), back button and
 * frame. The body is rendered by the selected check's content (DetailView), so
 * this stays agnostic to what the check shows.
 */
function HealthCheckDetailPage({ api, content, entry, onBack }: IHealthCheckDetailPageProps) {
  const { t } = useTranslation(["health_check", "common"]);
  const { DetailView } = content;

  return (
    <MainPage id="health-check-detail-page">
      <MainPage.Body>
        <div className="h-full space-y-6 overflow-y-auto p-6">
          <div className="flex items-center justify-between gap-x-6">
            <div className="flex grow items-center gap-x-2">
              <Pictogram name="health-check" size="sm" />

              <div className="grow">
                <div className="flex items-center gap-x-1.5">
                  <Typography as="h2" typographyType="heading-xs">
                    {t(`detail::title::${entry.severity}`)}
                  </Typography>

                  <Typography
                    as="div"
                    className="justity-center flex min-h-4 items-center rounded-sm border border-neutral-strong px-1"
                    typographyType="title-xs"
                  >
                    {t("common:::beta")}
                  </Typography>
                </div>

                <Typography appearance="moderate">
                  {t(`detail::subtitle::${entry.severity}`)}
                </Typography>
              </div>
            </div>

            <Button
              appearance="subdued"
              brand="neutral"
              leftIconPath={mdiArrowLeft}
              size="sm"
              onClick={onBack}
            >
              {t("common:::back")}
            </Button>
          </div>

          <DetailView api={api} entry={entry} onBack={onBack} />

          <PremiumBanner />
        </div>
      </MainPage.Body>
    </MainPage>
  );
}

export default HealthCheckDetailPage;
