import { Popover } from "@headlessui/react";
import { mdiBell, mdiBellOutline } from "@mdi/js";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

import { useExtensionContext } from "../../../../ExtensionProvider";
import { notifications as notificationsSelector } from "../../../../util/selectors";
import { IconButton } from "../IconButton";
import { NotificationItem } from "./NotificationItem";
import { useNotificationActions } from "./useNotificationActions";
import { useNotificationFiltering } from "./useNotificationFiltering";
import { useNotificationItems } from "./useNotificationItems";

/**
 * Inner component that receives popoverOpen as a prop so hooks can
 * react to it directly. The outer component just manages the Popover state.
 * This allows us to reset expand state and trigger auto-open when new notifications arrive.
 */
const NotificationsContent: React.FC<{ popoverOpen: boolean }> = ({
  popoverOpen,
}) => {
  const extensions = useExtensionContext();
  const api = extensions.getApi();

  const notifications = useSelector(notificationsSelector);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const prevIdsRef = useRef(new Set(notifications.map((n) => n.id)));

  const [expand, setExpand] = useState<string | undefined>(undefined);

  const filtered = useNotificationFiltering({
    notifications,
    open: popoverOpen,
  });
  const { dismissAll, suppress, triggerAction } = useNotificationActions({
    notifications,
    expand,
  });

  const handleExpandGroup = useCallback((groupId: string) => {
    setExpand(groupId);
  }, []);

  // Reset expand state when panel closes
  useEffect(() => {
    if (!popoverOpen && expand !== undefined) {
      setExpand(undefined);
    }
  }, [popoverOpen, expand]);

  // Auto-open popover when new notifications arrive
  useEffect(() => {
    const currentIds = new Set(notifications.map((n) => n.id));
    const hasNew = notifications.some((n) => !prevIdsRef.current.has(n.id));
    prevIdsRef.current = currentIds;

    if (hasNew && !popoverOpen && buttonRef.current) {
      buttonRef.current.click();
    }
  }, [notifications, popoverOpen]);

  const { items, collapsed } = useNotificationItems({ filtered, expand });

  return (
    <>
      <Popover.Button
        as={IconButton}
        disabled={notifications.length === 0}
        iconPath={notifications.length > 0 ? mdiBell : mdiBellOutline}
        itemCount={notifications.length}
        ref={buttonRef}
        title="Notifications"
        onClick={() => {
          api.events.emit(
            "analytics-track-click-event",
            "Notifications",
            `${popoverOpen ? "Close" : "Open"} Notifications`,
          );
        }}
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
  );
};

export const Notifications = () => (
  <Popover className="relative">
    {({ open }) => <NotificationsContent popoverOpen={open} />}
  </Popover>
);
