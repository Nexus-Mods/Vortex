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
  actions,
  children,
  status,
  title,
  onDismiss,
  onSettings,
  onView,
}: PropsWithChildren<{
  actions?: { label: string, onClick: () => void }[];
  status: "error" | "info" | "success" | "warning";
  title?: string;
  onDismiss?: () => void;
  onSettings?: () => void;
  onView?: () => void;
}>) => (
  <div className="flex gap-x-3 rounded-xs bg-surface-low p-2">
    <Icon
      className={joinClasses(["mt-0.5 shrink-0", statusMap[status].className])}
      path={statusMap[status].icon}
      size="sm"
    />

    <div className="flex grow flex-col gap-y-2">
      <Typography appearance="moderate" as="div" typographyType="body-sm">
        {!!title && <p className="font-semibold">{title}</p>}

        <p>{children} {onView && <TypographyLink />}</p>
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

    {(onSettings || onDismiss) && (
      <div className="flex shrink-0 items-start gap-x-1">
        {onSettings && (
          <Button
            buttonType="tertiary"
            leftIconPath={mdiCogOutline}
            size="xs"
            onClick={onSettings}
          />
        )}

        {onDismiss && (
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
      <Notification status="info" onView={() => console.log("view")}>
        Vortex will now handle Nexus Download links.
      </Notification>

      <Notification
        actions={[
          { label: 'More', onClick: () => console.log("more") },
          { label: 'Check again', onClick: () => console.log("check again") },
        ]}
        status="error"
      >
        Missing Masters
      </Notification>

      <Notification status="info" onDismiss={() => console.log("closed")}>
        Vortex will now handle Nexus Download links
      </Notification>

      <Notification
        status="success"
        onDismiss={() => console.log("closed")}
        onSettings={() => console.log("settings")}
      >
        Vortex will now handle Nexus Download links
      </Notification>

      <Notification
        status="warning"
        onDismiss={() => console.log("closed")}
        onMore={() => console.log("more")}
      >
        Vortex will now handle Nexus Download links
      </Notification>
    </Popover.Panel>
  </Popover>
);
