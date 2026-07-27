import { mdiArrowLeft } from "@mdi/js";
import React, { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IExtensionApi } from "@/types/IExtensionContext";
import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";
import { PageScroll } from "@/views/components/Page/PageScroll";

import { BetaBadge } from "../components/beta_badge/BetaBadge";
import { PremiumBanner } from "../components/premium_banner/PremiumBanner";
import { useHealthCheckTracking } from "../hooks/useHealthCheckTracking";
import {
  fileRequirementsCheckResult,
  hiddenFileRequirements,
  hiddenModRequirements,
  isAnyHealthCheckRunning,
  modRequirementsCheckResult,
} from "../selectors";
import { selectListedEntries } from "../utils/shared/listedEntries";
import type { IHealthCheckContent, IHealthCheckEntry } from "./content/types";

interface IHealthCheckDetailPageProps {
  api: IExtensionApi;
  content: IHealthCheckContent;
  entry: IHealthCheckEntry;
  onBack: () => void;
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

  // back_clicked fires only on an explicit Back click (not the auto-return below when a
  // requirement resolves), with the time spent on the detail page.
  const { trackBackClicked } = useHealthCheckTracking(api);
  const openedAtRef = useRef(0);

  useEffect(() => {
    openedAtRef.current = Date.now();
  }, []);

  const handleBack = () => {
    trackBackClicked({
      issue_id: entry.id,
      time_spent_on_detail_ms: Date.now() - openedAtRef.current,
    });

    onBack();
  };

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
    <Page active={active} id="health-check-detail-page" scrollable={false}>
      <PageHeader
        customTitle={
          <div className="flex items-center gap-x-1.5">
            <Typography appearance="moderate" as="h2" typographyType="heading-xs">
              {t(`detail::title::${shownEntry.severity}`)}
            </Typography>

            <BetaBadge />
          </div>
        }
        pictogramName="health-check"
        subtitle={t(`detail::subtitle::${shownEntry.severity}`)}
      >
        <Button
          appearance="subdued"
          brand="neutral"
          leftIconPath={mdiArrowLeft}
          size="sm"
          onClick={handleBack}
        >
          {t("common:::back")}
        </Button>
      </PageHeader>

      <PageScroll className="space-y-6 p-6">
        <DetailView api={api} entry={shownEntry} onBack={onBack} />

        <PremiumBanner
          tracking={{
            api,
            placement: "detail",
            issueId: shownEntry.id,
            totalIssues: selectListedEntries(api.getState()).length,
          }}
        />
      </PageScroll>
    </Page>
  );
}

export default HealthCheckDetailPage;
