import { Popover } from "@headlessui/react";
import { mdiBell, mdiBellOutline } from "@mdi/js";
import React, { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";

import { useExtensionContext } from "../../../../ExtensionProvider";
import { notifications as notificationsSelector } from "../../../../util/selectors";
import { IconButton } from "../IconButton";
import { NotificationItem } from "./NotificationItem";
import { useNotificationActions } from "./useNotificationActions";
import { useNotificationFiltering } from "./useNotificationFiltering";
import { useNotificationItems } from "./useNotificationItems";

export const Notifications = () => {
  const extensions = useExtensionContext();
  const api = extensions.getApi();

  const notifications = useSelector(notificationsSelector);

  const [expand, setExpand] = useState<string | undefined>(undefined);
  const [open, setOpen] = useState(false);

  const filtered = useNotificationFiltering({ notifications, open });
  const { dismissAll, suppress, triggerAction } = useNotificationActions({
    notifications,
    expand,
  });

  const toggle = useCallback(() => {
    api.events.emit(
      "analytics-track-click-event",
      "Notifications",
      `${open ? "Close" : "Open"} Notifications`,
    );
    setOpen(!open);
  }, [api, open]);

  const handleExpandGroup = useCallback((groupId: string) => {
    setExpand(groupId);
  }, []);

  // Reset expand state when notifications close
  useEffect(() => {
    if (!open && expand !== undefined) {
      setExpand(undefined);
    }
  }, [open, expand]);

  // Get grouped and sorted notification data
  const { items, collapsed } = useNotificationItems({
    filtered,
    expand,
  });

  return (
    <Popover className="relative">
      {({ open: popoverOpen }) => (
        <>
          <Popover.Button
            as={IconButton}
            iconPath={notifications.length > 0 ? mdiBell : mdiBellOutline}
            itemCount={notifications.length}
            title="Notifications"
            onClick={toggle}
          />

          {popoverOpen && items.length > 0 && (
            <Popover.Panel className="absolute right-0 z-popover mt-2.5 max-h-[50vh] w-sm space-y-0.5 overflow-y-auto rounded-sm border border-stroke-weak bg-surface-base p-1 shadow-md">
              {items.map((notification) => (
                <NotificationItem
                  collapsed={collapsed[notification.group]}
                  key={notification.id}
                  notification={notification}
                  onDismiss={dismissAll}
                  onExpand={handleExpandGroup}
                  onSuppress={suppress}
                  onTriggerAction={triggerAction}
                />
              ))}
            </Popover.Panel>
          )}
        </>
      )}
    </Popover>
  );
};
