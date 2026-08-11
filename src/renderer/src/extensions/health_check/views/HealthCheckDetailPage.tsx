import { mdiArrowLeft } from "@mdi/js";
import React, { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";
import { Page } from "@/views/components/Page/Page";
import { PageHeader } from "@/views/components/Page/PageHeader";
import { PageScroll } from "@/views/components/Page/PageScroll";

import { BetaBadge } from "../components/beta_badge/BetaBadge";
import { PremiumBanner } from "../components/premium_banner/PremiumBanner";
import {
  HealthCheckTrackingProvider,
  IssueProvider,
  useIssueTracking,
} from "../hooks/HealthCheckTracking.context";
import {
  fileRequirementsCheckResult,
  hiddenFileRequirements,
  hiddenModRequirements,
  isHealthCheckRunning,
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
 * Back button. A leaf so it can read the ambient issue identity this page provides, and so
 * the "opened at" mark is simply its own mount time. back_clicked fires only on an
 * explicit click, not the auto-return when a requirement resolves.
 */
const BackButton = ({ onBack }: { onBack: () => void }) => {
  const { t } = useTranslation(["health_check", "common"]);
  const { trackBackClicked } = useIssueTracking();
  const openedAtRef = useRef(0);

  useEffect(() => {
    openedAtRef.current = Date.now();
  }, []);

  return (
    <Button
      appearance="weak"
      brand="neutral"
      leftIconPath={mdiArrowLeft}
      onClick={() => {
        trackBackClicked({ time_spent_on_detail_ms: Date.now() - openedAtRef.current });
        onBack();
      }}
    >
      {t("common:::back")}
    </Button>
  );
};

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
  // Only the entry's own check can bring its requirements back, so waiting on the other one
  // would hold a resolved page open for the rest of that run.
  const isRunning = useSelector((state: IState) => isHealthCheckRunning(state, entry.checkId));

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

  // The detail page is returned early from HealthCheckPage, outside that page's provider,
  // so it establishes its own. Everything here belongs to one issue, including the
  // premium banner, so the provider wraps the whole page.
  return (
    <HealthCheckTrackingProvider api={api}>
      <IssueProvider entry={shownEntry}>
        <Page active={active} id="health-check-detail-page" scrollable={false}>
          <PageHeader
            customTitle={(scrolled) => (
              <div className="flex items-center gap-x-1.5">
                <Typography
                  appearance={scrolled ? "subdued" : "moderate"}
                  as="h2"
                  className="transition-colors"
                  typographyType="heading-xs"
                >
                  {t(`detail::title::${shownEntry.severity}`)}
                </Typography>

                <BetaBadge isSubdued={scrolled} />
              </div>
            )}
            pictogramName="health-check"
            subtitle={t(`detail::subtitle::${shownEntry.severity}`)}
          >
            <BackButton onBack={onBack} />
          </PageHeader>

          <PageScroll className="space-y-6 p-6">
            <DetailView api={api} entry={shownEntry} onBack={onBack} />

            <PremiumBanner
              api={api}
              placement="detail"
              totalIssues={selectListedEntries(api.getState()).length}
            />
          </PageScroll>
        </Page>
      </IssueProvider>
    </HealthCheckTrackingProvider>
  );
}

export default HealthCheckDetailPage;
