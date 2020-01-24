import Dropdown from '../controls/Dropdown';
import Icon from '../controls/Icon';
import PortalMenu from '../controls/PortalMenu';
import Spinner from '../controls/Spinner';
import { INotification, NotificationType } from '../types/INotification';
import { ComponentEx } from '../util/ComponentEx';

import { TFunction } from '../util/i18n';

import * as React from 'react';
import { Button, MenuItem } from 'react-bootstrap';

interface IActionProps {
  t: TFunction;
  title: string;
  count: number;
  onTrigger: (actionTitle: string) => void;
}

class Action extends React.Component<IActionProps, {}> {
  public render(): JSX.Element {
    const { t, count, title } = this.props;
    return <Button onClick={this.trigger}>{t(title, { count })}</Button>;
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
  onExpand: (groupId: string) => void;
  onTriggerAction: (notificationId: string, actionTitle: string) => void;
  onDismiss: (id: string) => void;
  onSuppress: (id: string) => void;
}

class Notification extends ComponentEx<IProps, { open: boolean }> {
  private menuRef: React.RefObject<any>;

  constructor(props: IProps) {
    super(props);

    this.menuRef = React.createRef<any>();

    this.initState({ open: false });
  }

  public render(): JSX.Element {
    const { t, collapsed } = this.props;
    const { actions, id, message, noDismiss, progress, title, type } = this.props.params;

    if ((message === undefined) && (title === undefined)) {
      return null;
    }

    const lines = (message || '').split('\n');

    const styleName = this.typeToStyle(type);

    return (
      <div role='alert' className={`notification alert-${styleName}`} >
        {progress !== undefined
          ? <span className='notification-progress' style={{ left: `${progress}%` }} />
          : null}
        {this.typeToIcon(type)}{' '}
        <div className='notification-textbox'>
          {title !== undefined ? <div className='notification-title'>{title}</div> : null}
          <div className='notification-message hover-expand'>
            {lines.map((line, idx) => <span key={idx}>{line}</span>)}
          </div>
        </div>
        <div className='notification-buttons'>
          {actions !== undefined
            ? actions.map(action => this.renderAction(action, collapsed))
            : null}
          {!noDismiss ? (
            <Button onClick={this.dismiss}>
              {(collapsed > 1) ? t('Dismiss All') : t('Dismiss')}
            </Button>
          ) : null}
          {(collapsed > 1) ? (
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
    const { t, params } = this.props;
    const { open } = this.state;

    // currently that's the only extra option
    const hasExtraOptions = params.allowSuppress === true;
    if (!hasExtraOptions) {
      return null;
    }

    return (
      <Dropdown id='notification-extra-options' ref={this.menuRef}>
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
            params.allowSuppress ? (
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

  private renderAction = (action, count) => {
    return (
      <Action
        key={action.title}
        t={this.props.t}
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
