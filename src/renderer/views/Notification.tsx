import React, { useCallback, useRef, useState, type FC, type JSX } from "react";
import { Button, MenuItem } from "react-bootstrap";
import { useTranslation } from "react-i18next";

import type {
  INotification,
  INotificationAction,
  NotificationType,
} from "../../types/INotification";

import Dropdown from "../controls/Dropdown";
import Icon from "../controls/Icon";
import PortalMenu from "../controls/PortalMenu";
import Spinner from "../controls/Spinner";
import { IconButton } from "../controls/TooltipControls";

interface IActionProps {
  icon: string;
  title: string;
  count: number;
  onTrigger: (actionTitle: string) => void;
}

const Action: FC<IActionProps> = (props) => {
  const { count, icon, title, onTrigger } = props;

  const { t } = useTranslation(["common"]);

  const trigger = useCallback(() => {
    onTrigger(title);
  }, [onTrigger, title]);

  if (icon !== undefined) {
    return (
      <IconButton icon={icon} tooltip={t(title, { count })} onClick={trigger} />
    );
  } else {
    return <Button onClick={trigger}>{t(title, { count })}</Button>;
  }
};

export interface IProps {
  collapsed: number;
  params: INotification & { process?: string };
  onExpand?: (groupId: string) => void;
  onTriggerAction?: (notificationId: string, actionTitle: string) => void;
  onDismiss?: (id: string) => void;
  onSuppress?: (id: string) => void;
}

const typeToStyle = (type: NotificationType): string => {
  switch (type) {
    case "success":
      return "success";
    case "activity":
      return "info";
    case "info":
      return "info";
    case "warning":
      return "warning";
    case "error":
      return "danger";
    default:
      return "warning";
  }
};

const typeToIcon = (type: NotificationType): JSX.Element | null => {
  switch (type) {
    case "activity":
      return <Spinner />;
    case "success":
      return <Icon name="feedback-success" />;
    case "info":
      return <Icon name="feedback-info" />;
    case "warning":
      return <Icon name="feedback-warning" />;
    case "error":
      return <Icon name="feedback-error" />;
    default:
      return null;
  }
};

export const Notification: FC<IProps> = (props) => {
  const {
    collapsed,
    onDismiss,
    onExpand,
    onSuppress,
    onTriggerAction,
    params,
  } = props;
  const { actions, id, message, noDismiss, progress, title, type } = params;

  const { t } = useTranslation(["common"]);

  const [open, setOpen] = useState(false);
  const menuRef = useRef<InstanceType<typeof Dropdown>>(null);

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const suppressNotification = useCallback(() => {
    onSuppress?.(params.id);
  }, [onSuppress, params.id]);

  const trigger = useCallback(
    (actionTitle: string) => {
      onTriggerAction?.(params.id, actionTitle);
    },
    [onTriggerAction, params.id],
  );

  const expand = useCallback(() => {
    onExpand?.(params.group);
  }, [onExpand, params.group]);

  const dismiss = useCallback(() => {
    onDismiss?.(params.id);
  }, [onDismiss, params.id]);

  const renderAction = (action: INotificationAction) => {
    return (
      <Action
        count={collapsed}
        icon={action.icon}
        key={action.title ?? action.icon}
        title={action.title}
        onTrigger={trigger}
      />
    );
  };

  const renderExtraOptions = () => {
    // currently that's the only extra option
    const hasExtraOptions = params.allowSuppress === true;
    if (!hasExtraOptions) {
      return null;
    }

    return (
      <Dropdown
        className="notification-extra-options"
        id={`notification-${params.id}-extra`}
        ref={menuRef}
      >
        <Dropdown.Toggle onClick={handleOpen}>
          <Icon name="settings" />
        </Dropdown.Toggle>

        <PortalMenu
          bsRole="menu"
          open={open}
          target={menuRef.current}
          onClick={handleClose}
          onClose={handleClose}
        >
          {params.allowSuppress && onSuppress !== undefined ? (
            <MenuItem eventKey="suppress" onClick={suppressNotification}>
              {t("Never show again")}
            </MenuItem>
          ) : null}
        </PortalMenu>
      </Dropdown>
    );
  };

  if (message === undefined && title === undefined) {
    return null;
  }

  const lines = (message || "")
    // improve chance the message can be line-broken on hover
    .replace(/\W/g, (_) => `${_}\u200b`)
    .split("\n");

  const styleName = typeToStyle(type);

  return (
    <div
      className={`
        notification
        alert-${styleName}
      `}
      role="alert"
    >
      {progress !== undefined ? (
        <span
          className="notification-progress"
          style={{ left: `${progress}%` }}
        />
      ) : null}

      <div className="btn btn-default btn-embed no-hover">
        {typeToIcon(type)}{" "}
      </div>

      <div className="notification-textbox">
        {title !== undefined ? (
          <div className="notification-title">{title}</div>
        ) : null}

        <div className="notification-message hover-expand">
          {lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      </div>

      <div className="notification-buttons">
        {actions !== undefined && onTriggerAction !== undefined
          ? actions.map((action) => renderAction(action))
          : null}

        {!noDismiss && onDismiss !== undefined ? (
          <IconButton
            icon="close"
            tooltip={collapsed > 1 ? t("Dismiss All") : t("Dismiss")}
            onClick={dismiss}
          />
        ) : null}

        {collapsed > 1 && onExpand !== undefined ? (
          <Button onClick={expand}>
            {t("{{ count }} More", { count: collapsed - 1 })}
          </Button>
        ) : null}

        {id !== undefined ? renderExtraOptions() : null}
      </div>
    </div>
  );
};

export default Notification;
