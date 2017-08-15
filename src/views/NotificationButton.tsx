import { dismissNotification } from '../actions/notifications';
import { INotification } from '../types/INotification';
import { IState } from '../types/IState';
import { ComponentEx, connect, translate } from '../util/ComponentEx';

import Icon from './Icon';
import Notification from './Notification';

import * as React from 'react';
import { Badge, Button, OverlayTrigger, Popover } from 'react-bootstrap';
import { CSSTransitionGroup } from 'react-transition-group';

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

class NotificationButton extends ComponentEx<IProps, {}> {
  private mRef: any = null;

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

    const items = notifications.sort(this.inverseSort).map(this.renderNotification);

    const popover = (
      <Popover id='notifications-popover' arrowOffsetLeft={64}>
        {items.length > 0 ? items : t('No Notifications')}
      </Popover>
    );

    return (
      <OverlayTrigger
        ref={this.setRef}
        overlay={popover}
        trigger='click'
        placement='bottom'
      >
        <Button id='notifications-button'>
          <Icon name='bell' />
          {items.length === 0 ? null : <Badge>{items.length}</Badge>}
        </Button>
      </OverlayTrigger>
    );
  }

  private setRef = ref => {
    this.mRef = ref;
  }

  private inverseSort(lhs: INotification, rhs: INotification) {
    return lhs.id < rhs.id ? 1 : (lhs.id > rhs.id ? -1 : 0);
  }

  private renderNotification = (notification: INotification) => {
    const { t, onDismiss } = this.props;

    const translated: INotification = { ...notification };
    translated.message = t(translated.message);
    return <Notification t={t} key={notification.id} params={translated} onDismiss={onDismiss} />;
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
