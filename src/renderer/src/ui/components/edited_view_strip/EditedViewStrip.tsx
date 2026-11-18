import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";

interface IEditedViewStripProps {
  /** The edited view's name, as the picker shows it. */
  viewLabel: string;
  /** Reset to default's tooltip: what going back to the defaults discards. */
  resetHint: string;
  /** Save as new view's tooltip: what the new view keeps. */
  saveHint: string;
  /** Puts the view back as it comes. */
  onReset: () => void;
  /** Saves what's showing as a view of the user's own. */
  onSave: () => void;
}

/**
 * Says the open built-in view has been edited, with buttons to put it back or save it as a new
 * view of the user's own. The page gives it its band and place.
 */
export const EditedViewStrip = ({
  viewLabel,
  resetHint,
  saveHint,
  onReset,
  onSave,
}: IEditedViewStripProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
        <Tooltip content={resetHint}>
          <Button
            appearance="subdued"
            brand="neutral"
            data-testid="edited-view-reset"
            size="sm"
            onClick={onReset}
          >
            {t("Reset to default")}
          </Button>
        </Tooltip>

        <Tooltip content={saveHint}>
          <Button
            appearance="moderate"
            brand="neutral"
            data-testid="edited-view-save"
            leftIcon="add"
            size="sm"
            onClick={onSave}
          >
            {t("Save as new view")}
          </Button>
        </Tooltip>
      </span>
    </div>
  );
};
