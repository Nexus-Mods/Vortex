import { mdiCog, mdiImageRefresh, mdiRefresh } from "@mdi/js";
import React from "react";

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
  return (
    <NoResults
      appearance="default"
      className="pt-8"
      iconPath={mdiImageRefresh}
      isError={false}
      message="There are no screenshots or videos available based on your filters."
      title="No media found"
    >
      {!!disabledSources && disabledSources.length > 0 && (
        <Typography appearance="strong" brand="info" typographyType="body-sm">
          There are {disabledSources.length} disabled media sources in your settings.
        </Typography>
      )}

      <div className="flex gap-4">
        {refresh && (
          <Button appearance="subdued" brand="neutral" leftIconPath={mdiRefresh} onClick={refresh}>
            Scan again
          </Button>
        )}

        {openSettings && (
          <Button appearance="subdued" brand="neutral" leftIconPath={mdiCog} onClick={openSettings}>
            Settings
          </Button>
        )}
      </div>
    </NoResults>
  );
}
