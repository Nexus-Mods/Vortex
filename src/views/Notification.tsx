import Dropdown from '../controls/Dropdown';
import Icon from '../controls/Icon';
import PortalMenu from '../controls/PortalMenu';
import Spinner from '../controls/Spinner';
import { INotification, INotificationAction, NotificationType } from '../types/INotification';
import { ComponentEx } from '../util/ComponentEx';

import { TFunction } from '../util/i18n';

import * as React from 'react';
import { Button, MenuItem } from 'react-bootstrap';
import { IconButton } from '../controls/TooltipControls';

interface IActionProps {
  t: TFunction;
  icon: string;
  title: string;
  count: number;
  onTrigger: (actionTitle: string) => void;
}

class Action extends React.Component<IActionProps, {}> {
  public render(): JSX.Element {
    const { t, count, icon, title } = this.props;
    if (icon !== undefined) {
      return <IconButton onClick={this.trigger} icon={icon} tooltip={t(title, { count })}/>;
    } else {
      return <Button onClick={this.trigger}>{t(title, { count })}</Button>;
    }
  }

  private trigger = () => {
    const { onTrigger, title } = this.props;
    onTrigger(title);
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

class Notification extends ComponentEx<IProps, { open: boolean }> {
  private menuRef: React.RefObject<any>;

  constructor(props: IProps) {
    super(props);

    this.menuRef = React.createRef<any>();

    this.initState({ open: false });
  }

  public render(): JSX.Element {
    const { t, collapsed, onDismiss, onExpand, onTriggerAction } = this.props;
    const { actions, id, message, noDismiss, progress, title, type } = this.props.params;

    if ((message === undefined) && (title === undefined)) {
      return null;
    }

    const lines = (message || '')
      // improve chance the message can be line-broken on hover
      .replace(/\W/g, _ => `${_}\u200b`)
      .split('\n');

    const styleName = this.typeToStyle(type);

    return (
      <div role='alert' className={`notification alert-${styleName}`} >
        {progress !== undefined
          ? <span className='notification-progress' style={{ left: `${progress}%` }} />
          : null}
        <div className='btn btn-default btn-embed no-hover'>
          {this.typeToIcon(type)}{' '}
        </div>
        <div className='notification-textbox'>
          {title !== undefined ? <div className='notification-title'>{title}</div> : null}
          <div className='notification-message hover-expand'>
            {lines.map((line, idx) => <span key={idx}>{line}</span>)}
          </div>
        </div>
        <div className='notification-buttons'>
          {(actions !== undefined) && (onTriggerAction !== undefined)
            ? actions.map(action => this.renderAction(action, collapsed))
            : null}
          {!noDismiss && (onDismiss !== undefined) ? (
            <IconButton
              icon='close'
              tooltip={(collapsed > 1) ? t('Dismiss All') : t('Dismiss')}
              onClick={this.dismiss}
            />
          ) : null}
          {((collapsed > 1) && (onExpand !== undefined)) ? (
            <Button onClick={this.expand}>
              {t('{{ count }} More', { count: collapsed - 1 })}
            </Button>
           ) : null}
          {id !== undefined
            ? this.renderExtraOptions()
            : null}
        </div>
      </div>
    );
  }

  private renderExtraOptions() {
    const { t, onSuppress, params } = this.props;
    const { open } = this.state;

    // currently that's the only extra option
    const hasExtraOptions = params.allowSuppress === true;
    if (!hasExtraOptions) {
      return null;
    }

    return (
      <Dropdown
          id={`notification-${params.id}-extra`}
          className='notification-extra-options'
          ref={this.menuRef}
      >
        <Dropdown.Toggle onClick={this.open}>
          <Icon name='settings'/>
        </Dropdown.Toggle>
        <PortalMenu
          open={open}
          onClick={this.close}
          onClose={this.close}
          target={this.menuRef.current}
          bsRole='menu'
        >
          {
            (params.allowSuppress && (onSuppress !== undefined)) ? (
              <MenuItem
                onClick={this.suppressNotification}
                eventKey='suppress'
              >
                {t('Never show again')}
              </MenuItem>
            ) : null
          }
        </PortalMenu>
      </Dropdown>
    );
  }

  private open = () => {
    this.nextState.open = true;
  }

  private close = () => {
    this.nextState.open = false;
  }

  private suppressNotification = () => {
    const { onSuppress, params } = this.props;
    onSuppress(params.id);
  }

  private renderAction = (action: INotificationAction, count) => {
    return (
      <Action
        key={action.title ?? action.icon}
        t={this.props.t}
        icon={action.icon}
        title={action.title}
        count={count}
        onTrigger={this.trigger}
      />
    );
  }

  private trigger = (actionTitle: string) => {
    const { onTriggerAction, params } = this.props;

    onTriggerAction(params.id, actionTitle);
  }

  private expand = () => {
    this.props.onExpand(this.props.params.group);
  }

  private typeToStyle(type: NotificationType) {
    switch (type) {
      case 'success': return 'success';
      case 'activity': return 'info';
      case 'info': return 'info';
      case 'warning': return 'warning';
      case 'error': return 'danger';
      default: return 'warning';
    }
  }

  private typeToIcon(type: NotificationType): JSX.Element {
    switch (type) {
      case 'activity': return <Spinner />;
      case 'success': return <Icon name='feedback-success' />;
      case 'info': return <Icon name='feedback-info' />;
      case 'warning': return <Icon name='feedback-warning' />;
      case 'error': return <Icon name='feedback-error' />;
      default: return null;
    }
  }

  private dismiss = () => this.props.onDismiss(this.props.params.id);
}

export default Notification;
