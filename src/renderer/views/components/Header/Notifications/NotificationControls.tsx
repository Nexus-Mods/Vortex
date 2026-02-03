import { mdiCogOutline, mdiClose } from "@mdi/js";
import React, { type FC, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../../../../../tailwind/components/next/button";

interface NotificationControlsProps {
  noDismiss?: boolean;
  allowSuppress?: boolean;
  collapsed: number;
  onDismiss: (e: MouseEvent) => void;
  onSuppress: (e: MouseEvent) => void;
}

export const NotificationControls: FC<NotificationControlsProps> = ({
  noDismiss,
  allowSuppress,
  collapsed,
  onDismiss,
  onSuppress,
}) => {
  const { t } = useTranslation(["common"]);

  if (noDismiss && !allowSuppress) {
    return null;
  }

  return (
    <div className="relative flex shrink-0 items-start gap-x-1">
      {allowSuppress && (
        <Button
          buttonType="tertiary"
          leftIconPath={mdiCogOutline}
          size="xs"
          title={t("Never show again")}
          onClick={onSuppress}
        />
      )}

      {!noDismiss && (
        <Button
          buttonType="tertiary"
          leftIconPath={mdiClose}
          size="xs"
          title={collapsed > 1 ? t("Dismiss All") : t("Dismiss")}
          onClick={onDismiss}
        />
      )}
    </div>
  );
};
