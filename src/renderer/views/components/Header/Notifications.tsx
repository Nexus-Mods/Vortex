import type { PropsWithChildren } from "react";

import { Popover } from "@headlessui/react";
import {
  mdiAlertOctagon,
  mdiAlertOutline,
  mdiBell,
  mdiCheckCircleOutline,
  mdiClose,
  mdiCogOutline,
  mdiInformationOutline,
} from "@mdi/js";
import React from "react";

import { Button } from "../../../../tailwind/components/next/button";
import { Icon } from "../../../../tailwind/components/next/icon";
import { Typography } from "../../../../tailwind/components/next/typography";
import { joinClasses } from "../../../../tailwind/components/next/utils";
import { IconButton } from "./IconButton";

type Status = "error" | "info" | "success" | "warning";

const statusMap: Record<Status, { className: string; icon: string }> = {
  error: { className: "text-danger-strong", icon: mdiAlertOctagon },
  info: { className: "text-info-strong", icon: mdiInformationOutline },
  success: { className: "text-success-strong", icon: mdiCheckCircleOutline },
  warning: { className: "text-warning-strong", icon: mdiAlertOutline },
};

const Notification = ({
  actions = [],
  children,
  status,
  title,
  onDismiss,
  onSettings,
  onView,
}: PropsWithChildren<{
  actions?: { label: string; onClick: () => void }[];
  status: "error" | "info" | "success" | "warning";
  title?: string;
  onDismiss?: () => void;
  onSettings?: () => void;
  onView?: () => void;
}>) => (
  <div
    className={joinClasses(["flex gap-x-3 rounded-xs bg-surface-low p-2"], {
      "cursor-pointer transition-colors hover:bg-surface-mid": !!onView,
    })}
    onClick={onView}
  >
    <Icon
      className={joinClasses([
        "relative mt-0.5 shrink-0",
        statusMap[status].className,
      ])}
      path={statusMap[status].icon}
      size="sm"
    />

    <div className="relative flex grow flex-col gap-y-2">
      <Typography appearance="moderate" as="div" typographyType="body-sm">
        {!!title && <p className="font-semibold">{title}</p>}

        <p>
          {children}

          {!!onView && (
            <span className="pl-1 text-neutral-strong underline">View</span>
          )}
        </p>
      </Typography>

      {!!actions.length && (
        <div className="flex gap-x-1">
          {actions.map(({ label, onClick }) => (
            <Button
              buttonType="tertiary"
              filled="weak"
              key={label}
              size="xs"
              onClick={onClick}
            >
              {label}
            </Button>
          ))}
        </div>
      )}
    </div>

    {(!!onSettings || !!onDismiss) && (
      <div className="relative flex shrink-0 items-start gap-x-1">
        {!!onSettings && (
          <Button
            buttonType="tertiary"
            leftIconPath={mdiCogOutline}
            size="xs"
            onClick={onSettings}
          />
        )}

        {!!onDismiss && (
          <Button
            buttonType="tertiary"
            leftIconPath={mdiClose}
            size="xs"
            onClick={onDismiss}
          />
        )}
      </div>
    )}
  </div>
);

export const Notifications = () => (
  <Popover className="relative">
    <Popover.Button as={IconButton} iconPath={mdiBell} title="Notifications" />

    <Popover.Panel className="absolute right-0 z-panel mt-2.5 w-sm space-y-0.5 rounded-sm border border-stroke-weak bg-surface-base p-1 shadow-md">
      <Notification
        status="info"
        onDismiss={() => console.log("dismiss")}
        onView={() => console.log("view")}
      >
        Vortex will now handle Nexus Download links.
      </Notification>

      <Notification
        actions={[
          { label: "Yes", onClick: () => console.log("yes") },
          { label: "No", onClick: () => console.log("no") },
        ]}
        status="error"
        title="Did this Collection work for you?"
        onDismiss={() => console.log("dismiss")}
        onSettings={() => console.log("settings")}
      >
        Gate to Sovngarde
      </Notification>

      <Notification
        actions={[{ label: "More", onClick: () => console.log("more") }]}
        status="info"
        onDismiss={() => console.log("closed")}
      >
        Vortex will now handle Nexus Download links
      </Notification>

      <Notification
        actions={[
          { label: "More", onClick: () => console.log("more") },
          { label: "Dismiss", onClick: () => console.log("dismiss") },
        ]}
        status="info"
      >
        Vortex will now handle Nexus Download links
      </Notification>

      <Notification
        actions={[
          { label: "Check again", onClick: () => console.log("check again") },
        ]}
        status="warning"
      >
        Vortex will now handle Nexus Download links
      </Notification>

      <Notification
        actions={[{ label: "More", onClick: () => console.log("more") }]}
        status="error"
      >
        Vortex will now handle Nexus Download links
      </Notification>

      <Notification
        actions={[{ label: "More", onClick: () => console.log("more") }]}
        status="success"
      >
        Vortex will now handle Nexus Download links
      </Notification>
    </Popover.Panel>
  </Popover>
);
