import { mdiEyeOffOutline, mdiClose } from "@mdi/js";
import React, { type MouseEvent } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";

interface NotificationControlsProps {
  noDismiss?: boolean;
  allowSuppress?: boolean;
  collapsed: number;
  onDismiss: (e: MouseEvent) => void;
  onSuppress: (e: MouseEvent) => void;
}

export const NotificationControls = ({
  noDismiss,
  allowSuppress,
  collapsed,
  onDismiss,
  onSuppress,
}: NotificationControlsProps) => {
  const { t } = useTranslation(["common"]);

  if (noDismiss && !allowSuppress) {
    return null;
  }

  return (
    <div className="relative flex shrink-0 items-start gap-x-1">
      {allowSuppress && (
        <Button
          appearance="weak"
          brand="neutral"
          leftIconPath={mdiEyeOffOutline}
          size="sm"
          title={t("Never show again")}
          onClick={onSuppress}
        />
      )}

      {!noDismiss && (
        <Button
          appearance="weak"
          brand="neutral"
          leftIconPath={mdiClose}
          size="sm"
          title={collapsed > 1 ? t("Dismiss All") : t("Dismiss")}
          onClick={onDismiss}
        />
      )}
    </div>
  );
};
