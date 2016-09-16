import { dismissNotification } from '../actions/actions';
import { INotification } from '../types/INotification';
import { IState } from '../types/IState';
import Notification from './Notification';

import * as React from 'react';
import { connect } from 'react-redux';

interface INotificationProps {
  id: string;
}

interface INotificationConnectedProps {
  notifications: INotification[];
}

interface INotificationActionProps {
  onDismiss: (id) => void;
}

class NotificationsBase extends React.Component
    <INotificationProps & INotificationActionProps & INotificationConnectedProps, {}> {
  constructor(props) {
    super(props);
  }

  public render(): JSX.Element {
    const { id, notifications } = this.props;
    return (
      <div id={id}>
      { notifications.map(this.renderNotification) }
      </div>
    );
  }

  private renderNotification = (notification: INotification) => {
    const { onDismiss } = this.props;
    return (<Notification key={notification.message} params={notification} onDismiss={onDismiss} />);
  }
}

function mapStateToProps(state: IState): INotificationConnectedProps {
  return {
    notifications: state.notifications.notifications,
  };
}

function mapDispatchToProps(dispatch): INotificationActionProps {
  return {
    onDismiss: (id: string) => dispatch(dismissNotification(id)),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(
  NotificationsBase) as React.ComponentClass<INotificationProps>;
