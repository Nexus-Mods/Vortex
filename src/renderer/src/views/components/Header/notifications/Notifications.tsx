import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { mdiBell, mdiBellOutline } from "@mdi/js";
import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";

import { useExtensionContext } from "@/ExtensionProvider";
import { Button, type IButtonProps } from "@/ui/components/button/Button";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";

import { notifications as notificationsSelector } from "../../../../util/selectors";
import { NotificationItem } from "./NotificationItem";
import { useNotificationActions } from "./useNotificationActions";
import { useNotificationFiltering } from "./useNotificationFiltering";
import { useNotificationItems } from "./useNotificationItems";

const Trigger = forwardRef<HTMLButtonElement, IButtonProps & { itemCount?: number }>(
  ({ "aria-label": ariaLabel, "aria-expanded": isOpen, itemCount, ...props }, ref) => (
    <Tooltip content={ariaLabel} disabled={!!isOpen} placement="bottom">
      <div className="group/icon-button relative">
        <Button
          appearance="weak"
          aria-expanded={isOpen}
          aria-label={ariaLabel}
          brand="neutral"
          {...props}
          ref={ref}
        />

        {!!itemCount && (
          <Typography
            appearance="inverted"
            as="span"
            className="pointer-events-none absolute -top-1 left-3 z-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full border-2 border-neutral-inverted bg-primary-moderate px-1 leading-none font-semibold transition-colors group-hover/icon-button:bg-primary-strong"
            typographyType="body-xs"
          >
            {itemCount > 9 ? "9+" : itemCount}
          </Typography>
        )}
      </div>
    </Tooltip>
  ),
);

Trigger.displayName = "NotificationsTrigger";

/**
 * Inner component that receives popoverOpen as a prop so hooks can
 * react to it directly. The outer component just manages the Popover state.
 * This allows us to reset expand state and trigger auto-open when new notifications arrive.
 */
const NotificationsContent: React.FC<React.PropsWithChildren<{ popoverOpen: boolean }>> = ({
  popoverOpen,
}) => {
  const extensions = useExtensionContext();
  const api = extensions.getApi();

  const notifications = useSelector(notificationsSelector);
  const visibleCount = useMemo(
    () => notifications.filter((n) => n.type !== "silent").length,
    [notifications],
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Empty seed so notifications already present at mount (dispatched
  // before this component rendered, e.g. during startup) count as new
  // on the first effect run and trigger the auto-open.
  const prevIdsRef = useRef<Set<string>>(new Set());

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

  // Auto-open popover when new notifications arrive.
  // Silent notifications should never open the tray.
  useEffect(() => {
    const currentIds = new Set(notifications.map((n) => n.id));
    const hasNew = notifications.some((n) => !prevIdsRef.current.has(n.id) && n.type !== "silent");
    prevIdsRef.current = currentIds;

    if (hasNew && !popoverOpen && buttonRef.current) {
      buttonRef.current.click();
    }
  }, [notifications, popoverOpen]);

  const { items, collapsed } = useNotificationItems({ filtered, expand });

  return (
    <>
      <PopoverButton
        aria-label="Notifications"
        as={Trigger}
        disabled={visibleCount === 0}
        itemCount={visibleCount}
        leftIconPath={visibleCount > 0 ? mdiBell : mdiBellOutline}
        ref={buttonRef}
        onClick={() => {
          api.events.emit(
            "analytics-track-click-event",
            "Notifications",
            `${popoverOpen ? "Close" : "Open"} Notifications`,
          );
        }}
      />

      {popoverOpen && items.length > 0 && (
        <PopoverPanel
          anchor={{ gap: 10, to: "bottom end" }}
          className="z-popover max-h-[50vh] w-sm space-y-0.5 overflow-y-auto rounded-sm border border-stroke-weak bg-surface-base p-1 shadow-md"
        >
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
        </PopoverPanel>
      )}
    </>
  );
};

export const Notifications = () => (
  <Popover className="relative">
    {({ open }) => <NotificationsContent popoverOpen={open} />}
  </Popover>
);
