import {
  mdiAlertOctagon,
  mdiAlertOutline,
  mdiCheckCircleOutline,
  mdiInformationOutline,
} from "@mdi/js";
import React, { type FC, useCallback } from "react";

import type {
  INotification,
  NotificationType,
} from "../../../../../types/INotification";

import { Icon } from "../../../../../tailwind/components/next/icon";
import { joinClasses } from "../../../../../tailwind/components/next/utils";
import { NotificationActions } from "./NotificationActions";
import { NotificationContent } from "./NotificationContent";
import { NotificationControls } from "./NotificationControls";
import {
  addWordBreakOpportunities,
  createNotificationHandler,
} from "./notificationUtils";
import { useNotificationTranslation } from "./useNotificationTranslation";

const STATUS_MAP = {
  error: { className: "text-danger-strong", icon: mdiAlertOctagon },
  warning: { className: "text-warning-strong", icon: mdiAlertOutline },
  success: { className: "text-success-strong", icon: mdiCheckCircleOutline },
  info: { className: "text-info-strong", icon: mdiInformationOutline },
  activity: { className: "text-info-strong", icon: mdiInformationOutline },
  global: { className: "text-info-strong", icon: mdiInformationOutline },
  silent: { className: "text-info-strong", icon: mdiInformationOutline },
} satisfies Record<NotificationType, { className: string; icon: string }>;

const getNotificationStatus = (
  type: NotificationType,
): { className: string; icon: string } => {
  return STATUS_MAP[type];
};

interface INotificationItemProps {
  notification: INotification;
  collapsed: number;
  onDismiss: (id: string) => void;
  onSuppress: (id: string) => void;
  onTriggerAction: (notificationId: string, actionTitle: string) => void;
  onExpand?: (groupId: string) => void;
}

export const NotificationItem: FC<INotificationItemProps> = ({
  notification,
  collapsed,
  onDismiss,
  onSuppress,
  onTriggerAction,
  onExpand,
}) => {
  const { actions, id, noDismiss, type, allowSuppress } = notification;

  // Handle translation
  const { translatedTitle, translatedMessage } = useNotificationTranslation({
    notification,
    collapsed,
  });

  const status = getNotificationStatus(type);

  // Event handlers
  const handleDismiss = useCallback(createNotificationHandler(id, onDismiss), [
    id,
    onDismiss,
  ]);

  const handleSuppress = useCallback(
    createNotificationHandler(id, onSuppress),
    [id, onSuppress],
  );

  const handleExpand = useCallback(() => {
    if (notification.group && onExpand) {
      onExpand(notification.group);
    }
  }, [notification.group, onExpand]);

  const handleActionClick = useCallback(
    (actionTitle: string) =>
      createNotificationHandler(id, (notifId) =>
        onTriggerAction(notifId, actionTitle),
      ),
    [id, onTriggerAction],
  );

  if (translatedMessage === undefined && translatedTitle === undefined) {
    return null;
  }

  const lines = addWordBreakOpportunities(translatedMessage || "");

  return (
    <div className="flex gap-x-3 rounded-xs bg-surface-low p-2">
      <Icon
        className={joinClasses(["relative mt-0.5 shrink-0", status.className])}
        path={status.icon}
        size="sm"
      />

      <div className="relative flex grow flex-col gap-y-2">
        <NotificationContent lines={lines} title={translatedTitle} />

        <NotificationActions
          actions={actions}
          collapsed={collapsed}
          onActionClick={handleActionClick}
          onExpand={handleExpand}
        />
      </div>

      <NotificationControls
        allowSuppress={allowSuppress}
        collapsed={collapsed}
        noDismiss={noDismiss}
        onDismiss={handleDismiss}
        onSuppress={handleSuppress}
      />
    </div>
  );
};
