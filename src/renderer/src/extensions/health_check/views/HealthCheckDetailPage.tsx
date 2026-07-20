import { mdiArrowLeft } from "@mdi/js";
import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { Pictogram } from "@/ui/components/pictogram/Pictogram";
import { Typography } from "@/ui/components/typography/Typography";
import PageRoot from "@/views/PageRoot";

import { PremiumBanner } from "../components/premium_banner/PremiumBanner";
import {
  fileRequirementsCheckResult,
  hiddenFileRequirements,
  hiddenModRequirements,
  isAnyHealthCheckRunning,
  modRequirementsCheckResult,
} from "../selectors";
import type { IHealthCheckContent, IHealthCheckEntry } from "./content/types";

interface IHealthCheckDetailPageProps {
  api: IExtensionApi;
  content: IHealthCheckContent;
  entry: IHealthCheckEntry;
  onBack: () => void;
  /** Forwarded from the listing (which gets it from MainPageContainer); drives page-hidden styling. */
  active?: boolean;
}

/**
 * Shared detail chrome: header (severity title/subtitle, beta), back button and
 * frame. The body is rendered by the selected check's content (DetailView), so
 * this stays agnostic to what the check shows.
 */
function HealthCheckDetailPage({
  api,
  content,
  entry,
  onBack,
  active,
}: IHealthCheckDetailPageProps) {
  const { t } = useTranslation(["health_check", "common"]);
  const { DetailView } = content;

  // Re-derive this entry from live state so requirements drop off as the health
  // check re-runs after an install/enable; once it's fully resolved (and no check
  // is mid-run) return to the listing. Mirrors HealthCheckPage's slice subscriptions.
  const fileResult = useSelector(fileRequirementsCheckResult);
  const modResult = useSelector(modRequirementsCheckResult);
  const hiddenFile = useSelector(hiddenFileRequirements);
  const hiddenMod = useSelector(hiddenModRequirements);
  const isRunning = useSelector(isAnyHealthCheckRunning);

  const liveEntry = useMemo(
    () => content.selectEntries(api.getState()).find((candidate) => candidate.id === entry.id),
    // eslint-disable-next-line @eslint-react/exhaustive-deps
    [api, content, entry.id, fileResult, modResult, hiddenFile, hiddenMod],
  );

  useEffect(() => {
    if (!liveEntry && !isRunning) {
      onBack();
    }
  }, [liveEntry, isRunning, onBack]);

  const shownEntry = liveEntry ?? entry;

  return (
    <PageRoot active={active} className="space-y-6 p-6" id="health-check-detail-page">
      <div className="flex items-center justify-between gap-x-6">
        <div className="flex grow items-center gap-x-2">
          <Pictogram name="health-check" size="sm" />

          <div className="grow">
            <div className="flex items-center gap-x-1.5">
              <Typography as="h2" typographyType="heading-xs">
                {t(`detail::title::${shownEntry.severity}`)}
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
              {t(`detail::subtitle::${shownEntry.severity}`)}
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

      <DetailView api={api} entry={shownEntry} onBack={onBack} />

      <PremiumBanner />
    </PageRoot>
  );
}

export default HealthCheckDetailPage;
