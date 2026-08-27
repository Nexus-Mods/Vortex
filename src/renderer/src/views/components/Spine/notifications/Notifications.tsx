import { Popover, PopoverButton } from "@headlessui/react";
import { mdiBell, mdiBellOutline } from "@mdi/js";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";

import { useExtensionContext } from "@/ExtensionProvider";
import type { INotification, NotificationType } from "@/types/INotification";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { joinClasses } from "@/ui/utils/joinClasses";

import { notifications as notificationsSelector } from "../../../../util/selectors";
import { SpineButton } from "../SpineButton";
import { NotificationItem } from "./components/NotificationItem";
import { useNotificationActions } from "./hooks/useNotificationActions.hook";
import { useNotificationFiltering } from "./hooks/useNotificationFiltering.hook";
import { useNotificationItems } from "./hooks/useNotificationItems.hook";

/**
 * Types that never pull the tray open. Silent is invisible everywhere; activity reports
 * background progress — a download starting, a game being set up — which belongs in the
 * tray for whoever opens it, but isn't news worth interrupting anyone for.
 */
const QUIET_TYPES: NotificationType[] = ["activity", "silent"];

/**
 * The pip reports the most serious thing waiting, so severities are ranked rather than
 * counted — one error among a dozen warnings still has to read as an error.
 */
const PIP_COLOURS = {
  error: "bg-danger-moderate",
  warning: "bg-warning-moderate",
  info: "bg-info-moderate",
} as const;

type PipSeverity = keyof typeof PIP_COLOURS;

export const pipSeverity = (notifications: INotification[]): PipSeverity | undefined => {
  const visible = notifications.filter((notification) => notification.type !== "silent");

  if (visible.length === 0) {
    return;
  }

  if (visible.some((notification) => notification.type === "error")) {
    return "error";
  }

  if (visible.some((notification) => notification.type === "warning")) {
    return "warning";
  }

  return "info";
};

interface INotificationsContentProps {
  close: () => void;
  popoverOpen: boolean;
}

/**
 * Inner component that receives popoverOpen as a prop so hooks can
 * react to it directly. The outer component just manages the Popover state.
 * This allows us to reset expand state and trigger auto-open when new notifications arrive.
 */
const NotificationsContent = ({ close, popoverOpen }: INotificationsContentProps) => {
  const extensions = useExtensionContext();
  const api = extensions.getApi();

  const notifications = useSelector(notificationsSelector);
  const visibleCount = useMemo(
    () => notifications.filter((n) => n.type !== "silent").length,
    [notifications],
  );
  const severity = useMemo(() => pipSeverity(notifications), [notifications]);
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

  // Auto-open popover when new notifications arrive, for the types worth interrupting for.
  useEffect(() => {
    const currentIds = new Set(notifications.map((n) => n.id));
    const hasNew = notifications.some(
      (n) => !prevIdsRef.current.has(n.id) && !QUIET_TYPES.includes(n.type),
    );
    prevIdsRef.current = currentIds;

    if (hasNew && !popoverOpen && buttonRef.current) {
      buttonRef.current.click();
    }
  }, [notifications, popoverOpen]);

  // The tray auto-opens for notifications that then expire on their own. Left open with
  // nothing to show, its panel unmounts but the bell stays lit — and `disabled` comes on
  // with it, so it can't be clicked shut either.
  useEffect(() => {
    if (popoverOpen && !visibleCount) {
      close();
    }
  }, [close, popoverOpen, visibleCount]);

  const { items, collapsed } = useNotificationItems({ filtered, expand });

  return (
    <>
      <PopoverButton
        isCircular
        as={SpineButton}
        border="hidden"
        disabled={!visibleCount}
        iconPath={popoverOpen ? mdiBell : mdiBellOutline}
        isActive={popoverOpen}
        ref={buttonRef}
        title="Notifications"
        tooltipDisabled={popoverOpen}
        onClick={() => {
          api.events.emit(
            "analytics-track-click-event",
            "Notifications",
            `${popoverOpen ? "Close" : "Open"} Notifications`,
          );
        }}
      >
        {!!severity && (
          <span
            className={joinClasses([
              "pointer-events-none absolute top-0 right-0 size-3 rounded-full border-2 border-surface-base",
              PIP_COLOURS[severity],
            ])}
            data-testid="notification-pip"
          />
        )}
      </PopoverButton>

      {popoverOpen && !!items.length && (
        <PopoverPanel anchor={{ gap: 8, to: "right end" }} className="w-xs overflow-visible!">
          <span className="pointer-events-none absolute bottom-6 left-0 size-2 -translate-x-1/2 translate-y-1/2 rotate-45 border-b border-l border-stroke-weak bg-surface-mid" />

          <div className="max-h-[50vh] space-y-0.5 overflow-y-auto">
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
          </div>
        </PopoverPanel>
      )}
    </>
  );
};

export const Notifications = () => (
  <Popover>
    {({ close, open }) => <NotificationsContent close={close} popoverOpen={open} />}
  </Popover>
);
