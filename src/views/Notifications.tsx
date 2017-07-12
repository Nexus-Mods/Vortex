import { dismissNotification } from '../actions/notifications';
import { INotification } from '../types/INotification';
import { IState } from '../types/IState';
import { ComponentEx, connect, translate } from '../util/ComponentEx';

import Notification from './Notification';

import * as React from 'react';
import { CSSTransitionGroup } from 'react-transition-group';

export interface IProps {
  id: string;
}

interface IConnectedProps {
  notifications: INotification[];
}

interface IActionProps {
  onDismiss: (id) => void;
}

class Notifications extends ComponentEx<IProps & IActionProps & IConnectedProps, {}> {
  public render(): JSX.Element {
    const { id, notifications } = this.props;

    const items = notifications.sort(this.inverseSort).map(this.renderNotification);

    return (
      <div id={id}>
        <CSSTransitionGroup
          transitionName='notification'
          transitionEnterTimeout={500}
          transitionLeaveTimeout={300}
        >
          { items }
        </CSSTransitionGroup>
      </div>
    );
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
      Notifications)) as React.ComponentClass<IProps>;
