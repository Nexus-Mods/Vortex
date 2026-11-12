import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";
import { PageContent } from "@/views/components/Page/PageContent";

interface IEditedViewStripProps {
  /** The edited preset's name, as the picker shows it. */
  viewLabel: string;
  /** Puts its sort and filters back as they come. */
  onReset: () => void;
  /** Saves what's showing as a view of the user's own. */
  onSave: () => void;
}

/**
 * Says the open preset has been edited, in a band under Browse's mods bar, with buttons to put it
 * back or save it as a new view of the user's own.
 */
export const EditedViewStrip = ({ viewLabel, onReset, onSave }: IEditedViewStripProps) => {
  const { t } = useTranslation();

  return (
    <div className="border-b border-stroke-weak bg-surface-mid pr-scrollbar">
      <PageContent isFullWidth className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
        <Typography
          appearance="subdued"
          as="span"
          brand="neutral-translucent"
          className="flex items-center gap-x-1.5"
          typographyType="body-sm"
        >
          <Icon name="info" size="sm" />

          {t("{{view}} view has been edited", { view: viewLabel })}
        </Typography>

        <span className="flex items-center gap-x-2">
          <Tooltip content={t("Discards your changes and returns this view to its defaults.")}>
            <Button appearance="subdued" brand="neutral" size="sm" onClick={onReset}>
              {t("Reset to default")}
            </Button>
          </Tooltip>

          <Tooltip
            content={t("Saves your current filters and sorting as a view you can return to.")}
          >
            <Button appearance="moderate" brand="neutral" leftIcon="add" size="sm" onClick={onSave}>
              {t("Save as new view")}
            </Button>
          </Tooltip>
        </span>
      </PageContent>
    </div>
  );
};
