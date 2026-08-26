import { Popover, PopoverButton } from "@headlessui/react";
import { mdiBell, mdiBellOutline } from "@mdi/js";
import React, {
  type ButtonHTMLAttributes,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSelector } from "react-redux";

import { useExtensionContext } from "@/ExtensionProvider";
import type { INotification } from "@/types/INotification";
import { Icon } from "@/ui/components/icon/Icon";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { joinClasses } from "@/ui/utils/joinClasses";

import { notifications as notificationsSelector } from "../../../../util/selectors";
import { NotificationItem } from "./components/NotificationItem";
import { useNotificationActions } from "./hooks/useNotificationActions.hook";
import { useNotificationFiltering } from "./hooks/useNotificationFiltering.hook";
import { useNotificationItems } from "./hooks/useNotificationItems.hook";

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

interface ITriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  iconPath: string;
  severity?: PipSeverity;
}

/**
 * Sibling of the spine's download button, so it borrows that button's shape and border
 * treatment rather than the header Button it used to render as.
 */
const Trigger = forwardRef<HTMLButtonElement, ITriggerProps>(
  ({ "aria-label": ariaLabel, "aria-expanded": isOpen, iconPath, severity, ...props }, ref) => (
    <Tooltip content={ariaLabel} disabled={!!isOpen} placement="right">
      <button
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={joinClasses([
          "relative flex size-12 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          "hover:border-neutral-strong hover:bg-surface-translucent-high",
          isOpen
            ? "border-neutral-strong bg-surface-translucent-low text-neutral-strong"
            : "border-transparent text-neutral-moderate",
        ])}
        {...props}
        ref={ref}
      >
        <Icon className="transition-colors" path={iconPath} size="lg" />

        {!!severity && (
          <span
            className={joinClasses([
              "pointer-events-none absolute top-0 right-0 size-3 rounded-full border-2 border-surface-base",
              PIP_COLOURS[severity],
            ])}
            data-testid="notification-pip"
          />
        )}
      </button>
    </Tooltip>
  ),
);

Trigger.displayName = "NotificationsTrigger";

interface INotificationsContentProps {
  popoverOpen: boolean;
}

/**
 * Inner component that receives popoverOpen as a prop so hooks can
 * react to it directly. The outer component just manages the Popover state.
 * This allows us to reset expand state and trigger auto-open when new notifications arrive.
 */
const NotificationsContent = ({ popoverOpen }: INotificationsContentProps) => {
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
        disabled={!visibleCount}
        iconPath={visibleCount ? mdiBell : mdiBellOutline}
        ref={buttonRef}
        severity={severity}
        onClick={() => {
          api.events.emit(
            "analytics-track-click-event",
            "Notifications",
            `${popoverOpen ? "Close" : "Open"} Notifications`,
          );
        }}
      />

      {popoverOpen && !!items.length && (
        <PopoverPanel
          anchor={{ gap: 8, to: "right end" }}
          className="max-h-[50vh] w-xs space-y-0.5 overflow-y-auto"
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
  <Popover>{({ open }) => <NotificationsContent popoverOpen={open} />}</Popover>
);
