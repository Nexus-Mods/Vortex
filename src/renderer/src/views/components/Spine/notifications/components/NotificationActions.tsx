import React, { type MouseEvent } from "react";
import { useTranslation } from "react-i18next";

import type { INotificationAction } from "@/types/INotification";
import { Button } from "@/ui/components/button/Button";

interface NotificationActionsProps {
  actions?: INotificationAction[];
  collapsed: number;
  onActionClick: (actionTitle: string) => (e: MouseEvent) => void;
  onExpand?: () => void;
}

export const NotificationActions = ({
  actions,
  collapsed,
  onActionClick,
  onExpand,
}: NotificationActionsProps) => {
  const { t } = useTranslation(["common"]);

  if (!actions?.length && collapsed <= 1) {
    return null;
  }

  return (
    <div className="flex gap-x-1">
      {actions?.map((action: INotificationAction) => (
        <Button
          appearance="moderate"
          brand="neutral"
          key={action.title ?? action.icon}
          size="sm"
          onClick={onActionClick(action.title)}
        >
          {t(action.title, { count: collapsed })}
        </Button>
      ))}

      {collapsed > 1 && onExpand && (
        <Button appearance="moderate" brand="neutral" size="sm" onClick={onExpand}>
          {t("{{ count }} More", { count: collapsed - 1 })}
        </Button>
      )}
    </div>
  );
};
