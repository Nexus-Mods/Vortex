import { mdiCog, mdiImageRefresh, mdiRefresh } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { NoResults } from "@/ui/components/no_results/NoResults";
import { Typography } from "@/ui/components/typography/Typography";

interface IMediaPageNoResultsProps {
  refresh?: () => void;
  openSettings?: () => void;
  disabledSources?: string[];
}

export default function MediaPageNoResults({
  disabledSources,
  refresh,
  openSettings,
}: IMediaPageNoResultsProps) {
  const { t } = useTranslation("media_page");
  return (
    <NoResults
      appearance="default"
      className="pt-8"
      iconPath={mdiImageRefresh}
      isError={false}
      message={t("There are no screenshots or videos available based on your filters.")}
      title={t("No media found")}
    >
      {!!disabledSources && disabledSources.length > 0 && (
        <Typography appearance="strong" brand="info" typographyType="body-sm">
          {t("There are {{count}} disabled media sources in your settings.", {
            count: disabledSources.length,
          })}
        </Typography>
      )}

      <div className="flex gap-4">
        {refresh && (
          <Button
            appearance="subdued"
            brand="neutral"
            data-testid={"no-results-refresh"}
            leftIconPath={mdiRefresh}
            onClick={refresh}
          >
            {t("Scan again")}
          </Button>
        )}

        {openSettings && (
          <Button
            appearance="subdued"
            brand="neutral"
            data-testid={"no-results-settings"}
            leftIconPath={mdiCog}
            onClick={openSettings}
          >
            {t("Settings")}
          </Button>
        )}
      </div>
    </NoResults>
  );
}
