import Dropdown from "../controls/Dropdown";
import Icon from "../controls/Icon";
import PortalMenu from "../controls/PortalMenu";
import Spinner from "../controls/Spinner";
import type {
  INotification,
  INotificationAction,
  NotificationType,
} from "../../types/INotification";

import type { TFunction } from "../../util/i18n";

import * as React from "react";
import { Button, MenuItem } from "react-bootstrap";
import { IconButton } from "../controls/TooltipControls";

interface IActionProps {
  t: TFunction;
  icon: string;
  title: string;
  count: number;
  onTrigger: (actionTitle: string) => void;
}

function Action(props: IActionProps): React.JSX.Element {
  const { t, count, icon, title, onTrigger } = props;

  const trigger = React.useCallback(() => {
    onTrigger(title);
  }, [onTrigger, title]);

  if (icon !== undefined) {
    return (
      <IconButton onClick={trigger} icon={icon} tooltip={t(title, { count })} />
    );
  } else {
    return <Button onClick={trigger}>{t(title, { count })}</Button>;
  }
}

export interface IProps {
  t: TFunction;
  collapsed: number;
  params: INotification & { process?: string };
  onExpand?: (groupId: string) => void;
  onTriggerAction?: (notificationId: string, actionTitle: string) => void;
  onDismiss?: (id: string) => void;
  onSuppress?: (id: string) => void;
}

function typeToStyle(type: NotificationType): string {
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
}

function typeToIcon(type: NotificationType): React.JSX.Element {
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
}

function Notification(props: IProps): React.JSX.Element {
  const {
    t,
    collapsed,
    onDismiss,
    onExpand,
    onSuppress,
    onTriggerAction,
    params,
  } = props;
  const { actions, id, message, noDismiss, progress, title, type } = params;

  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<any>(null);

  const handleOpen = React.useCallback(() => {
    setOpen(true);
  }, []);

  const handleClose = React.useCallback(() => {
    setOpen(false);
  }, []);

  const suppressNotification = React.useCallback(() => {
    onSuppress?.(params.id);
  }, [onSuppress, params.id]);

  const trigger = React.useCallback(
    (actionTitle: string) => {
      onTriggerAction?.(params.id, actionTitle);
    },
    [onTriggerAction, params.id],
  );

  const expand = React.useCallback(() => {
    onExpand?.(params.group);
  }, [onExpand, params.group]);

  const dismiss = React.useCallback(() => {
    onDismiss?.(params.id);
  }, [onDismiss, params.id]);

  const renderAction = (action: INotificationAction) => {
    return (
      <Action
        key={action.title ?? action.icon}
        t={t}
        icon={action.icon}
        title={action.title}
        count={collapsed}
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
        id={`notification-${params.id}-extra`}
        className="notification-extra-options"
        ref={menuRef}
      >
        <Dropdown.Toggle onClick={handleOpen}>
          <Icon name="settings" />
        </Dropdown.Toggle>
        <PortalMenu
          open={open}
          onClick={handleClose}
          onClose={handleClose}
          target={menuRef.current}
          bsRole="menu"
        >
          {params.allowSuppress && onSuppress !== undefined ? (
            <MenuItem onClick={suppressNotification} eventKey="suppress">
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
    <div role="alert" className={`notification alert-${styleName}`}>
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
          {lines.map((line, idx) => (
            <span key={idx}>{line}</span>
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
}

export default Notification;
