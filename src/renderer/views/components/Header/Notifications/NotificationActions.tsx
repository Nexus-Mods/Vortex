import React, { type FC, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";

import type { INotificationAction } from "../../../../types/INotification";

import { Button } from "../../../../ui/components/button";

interface NotificationActionsProps {
  actions?: INotificationAction[];
  collapsed: number;
  onActionClick: (actionTitle: string) => (e: MouseEvent) => void;
  onExpand?: () => void;
}

export const NotificationActions: FC<NotificationActionsProps> = ({
  actions,
  collapsed,
  onActionClick,
  onExpand,
}) => {
  const { t } = useTranslation(["common"]);

  if (!actions?.length && collapsed <= 1) {
    return null;
  }

  return (
    <div className="flex gap-x-1">
      {actions?.map((action: INotificationAction) => (
        <Button
          buttonType="tertiary"
          filled="weak"
          key={action.title ?? action.icon}
          size="xs"
          onClick={onActionClick(action.title)}
        >
          {t(action.title, { count: collapsed })}
        </Button>
      ))}

      {collapsed > 1 && onExpand && (
        <Button
          buttonType="tertiary"
          filled="weak"
          size="xs"
          onClick={onExpand}
        >
          {t("{{ count }} More", { count: collapsed - 1 })}
        </Button>
      )}
    </div>
  );
};
