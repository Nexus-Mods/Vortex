import { dismissNotification, fireNotificationAction } from '../actions/notifications';
import { suppressNotification } from '../actions/notificationSettings';
import { INotification, INotificationAction } from '../types/INotification';
import { IState } from '../types/IState';
import { ComponentEx, connect, translate } from '../util/ComponentEx';

import Icon from '../controls/Icon';
import Notification from './Notification';

import * as React from 'react';
import { Badge, Button, OverlayTrigger, Popover } from 'react-bootstrap';

export interface IBaseProps {
  id: string;
  hide: boolean;
}

interface IConnectedProps {
  notifications: INotification[];
}

interface IActionProps {
  onDismiss: (id: string) => void;
  onSuppress: (id: string) => void;
}

type IProps = IBaseProps & IActionProps & IConnectedProps;

interface IComponentState {
  expand: string;
}

class NotificationButton extends ComponentEx<IProps, IComponentState> {
  private mRef: any = null;

  constructor(props: IProps) {
    super(props);

    this.initState({ expand: undefined });
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if ((this.props.notifications !== newProps.notifications)
        && (this.mRef !== null)) {
      if (newProps.notifications.length === 0) {
        // if the last notification was dismissed, hide
        this.mRef.hide();
      } else {
        const oldIds = new Set(this.props.notifications.map(not => not.id));
        const newId = newProps.notifications.find(not => !oldIds.has(not.id));
        if (newId !== undefined) {
          // if a new notification was added, show, to ensure user sees it
          this.mRef.show();
        }
      }
    }
  }

  public render(): JSX.Element {
    const { t, hide, notifications } = this.props;

    const collapsed: { [groupId: string]: number } = {};

    const items = [].concat(notifications)
      .reduce((prev: INotification[], notification: INotification) =>
            this.groupNotifications(prev, notification, collapsed), [])
      .sort(this.inverseSort)
      .map(notification => this.renderNotification(notification, collapsed));

    const popover = (
      <Popover
        id='notifications-popover'
        arrowOffsetLeft={64}
        style={{ display: hide ? 'none' : 'block' }}
      >
        {items.length > 0 ? items : t('No Notifications')}
      </Popover>
    );

    // TODO: current typings don't expose "shouldUpdatePosition" but it's there
    const MyOverlayTrigger: any = OverlayTrigger;

    return (
      <MyOverlayTrigger
        ref={this.setRef}
        overlay={popover}
        trigger='click'
        placement='bottom'
        shouldUpdatePosition={true}
        onExit={this.unExpand}
      >
        <Button id='notifications-button'>
          <Icon name='notifications' />
          {items.length === 0 ? null : <Badge>{notifications.length}</Badge>}
        </Button>
      </MyOverlayTrigger>
    );
  }

  private groupNotifications = (previous: INotification[],
                                notification: INotification,
                                collapsed: { [groupId: string]: number }) => {
    if ((notification.group !== undefined) && (notification.group !== this.state.expand)) {
      if (collapsed[notification.group] === undefined) {
        previous.push(notification);
        collapsed[notification.group] = 0;
      }
      collapsed[notification.group]++;
    } else {
      previous.push(notification);
    }
    return previous;
  }

  private expand = (groupId: string) => {
    this.nextState.expand = groupId;
  }

  private unExpand = () => {
    this.nextState.expand = undefined;
  }

  private setRef = ref => {
    this.mRef = ref;
    if (ref !== null) {
      if (this.props.notifications.length > 0) {
        this.mRef.show();
      } else {
        this.mRef.hide();
      }
    }
  }

  private inverseSort(lhs: INotification, rhs: INotification) {
    return lhs.createdTime - rhs.createdTime;
  }

  private renderNotification = (notification: INotification,
                                collapsed: { [groupId: string]: number }) => {
    const { t } = this.props;

    const translated: INotification = { ...notification };
    translated.title = ((translated.title !== undefined)
      && ((notification.localize === undefined) || (notification.localize.title !== false)))
      ? t(translated.title, { replace: translated.replace })
      : translated.title;

    if ((collapsed[notification.group] > 1) && (translated.title !== undefined)) {
      translated.message = t('<Multiple>');
    } else {
      translated.message =
        ((notification.localize === undefined) || (notification.localize.message !== false))
          ? t(translated.message, { replace: translated.replace })
          : translated.message;
    }

    return (
      <Notification
        t={t}
        key={notification.id}
        params={translated}
        collapsed={collapsed[notification.group]}
        onExpand={this.expand}
        onTriggerAction={this.triggerAction}
        onDismiss={this.dismissAll}
        onSuppress={this.suppress}
      />
    );
  }

  private triggerAction = (notificationId: string, actionTitle: string) => {
    const { notifications, onDismiss } = this.props;
    const noti = notifications.find(iter => iter.id === notificationId);
    if (noti === undefined) {
      return;
    }

    const callAction = (id: string, action: INotificationAction, idx: number) => {
      if (idx === -1) {
        return;
      }

      if (action.action !== undefined) {
        action.action(() => onDismiss(id));
      } else {
        fireNotificationAction(id, noti.process, idx, () => onDismiss(id));
      }
    };

    if ((noti.group === undefined) || (noti.group === this.state.expand)) {
      const actionIdx = noti.actions.findIndex(iter => iter.title === actionTitle);
      callAction(noti.id, noti.actions[actionIdx], actionIdx);
    } else {
      notifications.filter(iter => iter.group === noti.group).forEach(iter => {
        const actionIdx = iter.actions.findIndex(actIter => actIter.title === actionTitle);
        callAction(iter.id, iter.actions[actionIdx], actionIdx);
      });
    }
  }

  private dismissAll = (notificationId: string) => {
    const { notifications, onDismiss } = this.props;
    const noti = notifications.find(iter => iter.id === notificationId);
    if (noti === undefined) {
      return;
    }
    if ((noti.group === undefined) || (noti.group === this.state.expand)) {
      onDismiss(notificationId);
    } else {
      notifications.filter(iter => iter.group === noti.group).forEach(iter => {
        onDismiss(iter.id);
      });
    }
  }

  private suppress = (notificationId: string) => {
    this.props.onDismiss(notificationId);
    this.props.onSuppress(notificationId);
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    notifications: state.session.notifications.notifications,
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onDismiss: (id: string) => dispatch(dismissNotification(id)),
    onSuppress: (id: string) => dispatch(suppressNotification(id, true)),
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(
      NotificationButton)) as React.ComponentClass<IBaseProps>;
