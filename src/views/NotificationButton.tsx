import { dismissNotification, fireNotificationAction } from '../actions/notifications';
import { suppressNotification } from '../actions/notificationSettings';
import { INotification, INotificationAction, NotificationType } from '../types/INotification';
import { IState } from '../types/IState';
import { ComponentEx, connect, translate } from '../util/ComponentEx';

import Icon from '../controls/Icon';
import Debouncer from '../util/Debouncer';
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
  open: boolean;
  filtered: INotification[];
}

class NotificationButton extends ComponentEx<IProps, IComponentState> {
  private mRef: any = null;
  private mUpdateTimer: NodeJS.Timeout = undefined;
  private mUpdateDebouncer: Debouncer;
  private mMounted: boolean = false;

  constructor(props: IProps) {
    super(props);

    this.initState({
      expand: undefined,
      open: false,
      filtered: [],
    });

    this.mUpdateDebouncer = new Debouncer(this.triggerFilter, 1000);
  }

  public componentDidMount() {
    this.updateFiltered();
    this.mMounted = true;
  }

  public componentWillUnmount() {
    this.mMounted = false;
    if (this.mUpdateTimer !== undefined) {
      clearTimeout(this.mUpdateTimer);
    }
  }

  public componentDidUpdate(prevProps: IProps) {
    if (prevProps.notifications !== this.props.notifications) {
      if (prevProps.notifications.length !== this.props.notifications.length) {
        this.mUpdateDebouncer.runNow(() => null);
      } else {
        this.mUpdateDebouncer.schedule();
      }
    }
  }

  public render(): JSX.Element {
    const { t, hide, notifications } = this.props;
    const { filtered } = this.state;

    const collapsed: { [groupId: string]: number } = {};

    const items = filtered.slice()
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
        <Button id='notifications-button' onClick={this.toggle}>
          <Icon name='notifications' />
          {notifications.length === 0 ? null : <Badge>{notifications.length}</Badge>}
        </Button>
      </MyOverlayTrigger>
    );
  }

  private displayTime = (item: INotification) => {
    if (item.displayMS !== undefined) {
      return item.displayMS;
    }

    return {
      warning: 30000,
      error: 30000,
      success: 10000,
      info: 10000,
      activity: null,
    }[item.type] || 10000;
  }

  private triggerFilter = () => {
    this.updateFiltered();
    return Promise.resolve();
  }

  private updateFiltered() {
    const { notifications } = this.props;
    const { open } = this.state;

    this.mUpdateTimer = undefined;

    if (!this.mMounted) {
      return;
    }

    let filtered = notifications.slice();
    let nextTimeout = null;
    const now = Date.now();
    if (!open) {
      filtered = notifications.filter(item => {
        if (item.type === 'activity') {
          return true;
        }
        const displayTime = this.displayTime(item);
        if (displayTime === null) {
          return true;
        }

        const timeout = item.updatedTime + displayTime;
        if (timeout > now) {
          if ((nextTimeout === null) || (timeout < nextTimeout)) {
            nextTimeout = timeout;
          }
          return true;
        }

        return false;
      });
    }

    this.nextState.filtered = filtered;

    if (!open) {
      if (filtered.length > 0) {
        this.mRef?.show();
        if (this.mUpdateTimer !== undefined) {
          // should never happen
          clearTimeout(this.mUpdateTimer);
        }
        if (nextTimeout !== null) {
          // if one of the displayed notifications has a timeout, refresh once that timeout expires
          // (adding 100ms for good measure)
          this.mUpdateTimer = setTimeout(this.triggerFilter, (nextTimeout - now) + 100);
        }
      } else {
        this.mRef?.hide();
      }
    } else {
      // if open, make sure it gets displayed, just to be sure
      this.mRef?.show();
    }
  }

  private toggle = () => {
    if (!this.state.open) {
      this.mRef?.show();
      this.nextState.filtered = this.props.notifications.slice();
    }
    this.nextState.open = !this.state.open;
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
