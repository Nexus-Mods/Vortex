import { dismissNotification } from '../actions/notifications';
import { INotification } from '../types/INotification';
import { IState } from '../types/IState';
import { ComponentEx, connect, translate } from '../util/ComponentEx';

import Icon from '../controls/Icon';
import Notification from './Notification';

import * as React from 'react';
import { Badge, Button, OverlayTrigger, Popover } from 'react-bootstrap';

export interface IBaseProps {
  id: string;
}

interface IConnectedProps {
  notifications: INotification[];
}

interface IActionProps {
  onDismiss: (id) => void;
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

  public componentWillReceiveProps(newProps: IProps) {
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
    const { t, id, notifications } = this.props;

    const collapsed: { [groupId: string]: number } = {};

    const items = [].concat(notifications)
      .reduce((prev: INotification[], notification: INotification) =>
            this.groupNotifications(prev, notification, collapsed), [])
      .sort(this.inverseSort)
      .map(notification => this.renderNotification(notification, collapsed));

    const popover = (
      <Popover id='notifications-popover' arrowOffsetLeft={64}>
        {items.length > 0 ? items : t('No notifications')}
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
    return lhs.id < rhs.id ? 1 : (lhs.id > rhs.id ? -1 : 0);
  }

  private renderNotification = (notification: INotification,
                                collapsed: { [groupId: string]: number }) => {
    const { t } = this.props;

    const translated: INotification = { ...notification };
    translated.title = translated.title !== undefined ? t(translated.title) : undefined;
    translated.message = t(translated.message);
    return (
      <Notification
        t={t}
        key={notification.id}
        params={translated}
        collapsed={collapsed[notification.group]}
        onExpand={this.expand}
        onDismiss={this.dismiss}
      />
    );
  }

  private dismiss = (notificationId: string) => {
    const { notifications, onDismiss } = this.props;
    const noti = notifications.find(iter => iter.id === notificationId);
    if ((noti.group === undefined) || (noti.group === this.state.expand)) {
      onDismiss(notificationId);
    } else {
      notifications.filter(iter => iter.group === noti.group).forEach(iter => {
        onDismiss(iter.id);
      });
    }
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
  };
}

export default
  translate(['common'], { wait: true })(
    connect(mapStateToProps, mapDispatchToProps)(
      NotificationButton)) as React.ComponentClass<IBaseProps>;
