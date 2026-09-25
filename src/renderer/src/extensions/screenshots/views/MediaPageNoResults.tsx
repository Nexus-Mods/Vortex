import { mdiCog, mdiImageRefresh, mdiRefresh } from "@mdi/js";
import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { NoResults } from "@/ui/components/no_results/NoResults";
import { Typography } from "@/ui/components/typography/Typography";

interface IMediaPageNoResultsProps {
  refresh?: () => void;
  openSettings?: () => void;
  disabledSources?: readonly string[];
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
      message={t("listing::no_results::message")}
      title={t("listing::no_results::title")}
    >
      {!!disabledSources && disabledSources.length > 0 && (
        <Typography appearance="strong" brand="info" typographyType="body-sm">
          {t("listing::no_results::disabled_sources", {
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
            {t("listing::actions::scan_again")}
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
            {t("common:::settings")}
          </Button>
        )}
      </div>
    </NoResults>
  );
}
