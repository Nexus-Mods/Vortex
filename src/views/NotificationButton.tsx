import { dismissNotification, fireNotificationAction } from '../actions/notifications';
import { suppressNotification } from '../actions/notificationSettings';
import { INotification, INotificationAction, NotificationType } from '../types/INotification';
import { IState } from '../types/IState';
import { ComponentEx, connect, translate } from '../util/ComponentEx';

import Icon from '../controls/Icon';
import RadialProgress, { IBar } from '../controls/RadialProgress';
import Debouncer from '../util/Debouncer';
import Notification from './Notification';

import * as React from 'react';
import { Badge, Button, Overlay, Popover } from 'react-bootstrap';

export interface IBaseProps {
  id: string;
  // force-hide. In this mode notifications are never shown
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
  private mButtonRef = React.createRef<Button>();
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

    this.mUpdateDebouncer = new Debouncer(this.triggerFilter, 200);
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
        this.quickUpdate();
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

    const combinedProgress: IBar[] = [];

    const progress = notifications.filter(iter => iter.progress !== undefined);
    if (progress.length > 0) {
      const percentages = Math.min(...progress.map(iter => iter.progress));
      combinedProgress.push({
        class: 'running',
        min: 0,
        max: 100,
        value: percentages,
      });
    }

    return (
      <div style={{ display: 'inline-block' }}>
        <Button id='notifications-button' onClick={this.toggle} ref={this.mButtonRef}>
          <Icon name='notifications' />
          <RadialProgress
            className='notifications-progress'
            data={combinedProgress}
            offset={8}
            totalRadius={8}
          />
          {notifications.length === 0 ? null : <Badge>{notifications.length}</Badge>}
        </Button>

        <Overlay
          placement='bottom'
          rootClose={false}
          onExit={this.unExpand}
          show={items.length > 0}
          target={this.mButtonRef.current}
          shouldUpdatePosition={false}
        >
          {popover}
        </Overlay>
      </div>
    );
  }

  private displayTime = (item: INotification) => {
    if (item.displayMS !== undefined) {
      return item.displayMS;
    }

    return {
      warning: 10000,
      error: 10000,
      success: 5000,
      info: 5000,
      activity: null,
    }[item.type] || 10000;
  }

  private quickUpdate() {
    // updating only progress and message
    const { notifications } = this.props;
    const { filtered } = this.state;
    for (let i = 0; i < filtered.length; ++i) {
      // there shouldn't be notifications without id here but just to be safe
      if (filtered[i].id !== undefined) {
        const ref = notifications.find(n => n.id === filtered[i].id);
        // if the notification no longer exists we're not removing it here,
        // it will be removed in the "big" update (updateFiltered) a bit later
        if ((ref !== undefined)
            && ((filtered[i].message !== ref.message)
                || (filtered[i].progress !== ref.progress))) {
          this.nextState.filtered[i] = {
            ...filtered[i],
            message: ref.message,
            progress: ref.progress,
          };
        }
      }
    }
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

    let filtered = notifications.slice().filter(item => item.type !== 'silent');
    let nextTimeout = null;
    const now = Date.now();
    if (!open) {
      filtered = filtered.filter(item => {
        const displayTime = this.displayTime(item);
        if (displayTime === null) {
          return true;
        }

        const timeout = (item.type === 'activity' ? item.createdTime : item.updatedTime)
                      + displayTime;
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
        if (this.mUpdateTimer !== undefined) {
          // should never happen
          clearTimeout(this.mUpdateTimer);
        }
        if (nextTimeout !== null) {
          // if one of the displayed notifications has a timeout, refresh once that timeout expires
          // (adding 100ms for good measure)
          this.mUpdateTimer = setTimeout(this.triggerFilter, (nextTimeout - now) + 100);
        }
      }
    }
  }

  private toggle = (evt: React.MouseEvent<any>) => {
    evt.preventDefault();
    this.context.api.events.emit(
      'analytics-track-click-event',
      'Notifications',
      `${this.state.open ? 'Close' : 'Open'} Notifications`,
    );
    this.nextState.open = !this.state.open;
    setTimeout(() => {
      this.mUpdateDebouncer.runNow(() => null);
    }, 0);
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
    this.context.api.events.emit('analytics-track-click-event', 'Notifications', 'Dismiss');
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
