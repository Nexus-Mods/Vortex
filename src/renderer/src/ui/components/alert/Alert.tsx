import {
  mdiAlertOctagon,
  mdiAlertOutline,
  mdiCheckCircleOutline,
  mdiClose,
  mdiInformationOutline,
} from "@mdi/js";
import React, { type HTMLAttributes, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { Icon } from "@/ui/components/icon/Icon";
import { joinClasses } from "@/ui/utils/joinClasses";

export type AlertSeverity = "info" | "success" | "warning" | "danger";

export interface IAlertProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  severity?: AlertSeverity;
  action?: ReactNode;
  /** Supplying this adds a close button that hides the alert and calls back. */
  onDismiss?: () => void;
  dismissLabel?: string;
}

const severityIcons: Record<AlertSeverity, string> = {
  danger: mdiAlertOctagon,
  info: mdiInformationOutline,
  success: mdiCheckCircleOutline,
  warning: mdiAlertOutline,
};

/**
 * Full-width bar carrying a short message about the page it sits on, optionally
 * with a control that acts on it. Replaces react-bootstrap's `Alert`.
 *
 * The severity colours the icon only — the surface stays neutral in every state,
 * so a row of these reads as one band rather than four competing blocks.
 */
export const Alert = ({
  action,
  children,
  className,
  dismissLabel,
  onDismiss,
  severity = "info",
  ...props
}: IAlertProps) => {
  const { t } = useTranslation();
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  const dismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className={joinClasses(["nxm-alert", `nxm-alert-${severity}`, className])}
      role="status"
      {...props}
    >
      <div className="nxm-alert-message">
        <Icon className="nxm-alert-icon" path={severityIcons[severity]} size="sm" />

        <p className="nxm-alert-text">{children}</p>
      </div>

      {!!action && <div className="nxm-alert-action">{action}</div>}

      {!!onDismiss && (
        <Button
          appearance="weak"
          aria-label={dismissLabel ?? t("Dismiss")}
          brand="neutral"
          className="nxm-alert-dismiss"
          leftIconPath={mdiClose}
          size="xs"
          onClick={dismiss}
        />
      )}
    </div>
  );
};
