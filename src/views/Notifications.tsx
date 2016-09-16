import { INotification } from '../types/INotification';
import { IState } from '../types/IState';
import Notification from './Notification';

import { log } from '../util/log';

import * as React from 'react';
import { connect } from 'react-redux';

interface INotificationProps {
  id: string;
}

interface INotificationConnectedProps {
  notifications: INotification[];
}

class NotificationsBase extends React.Component<INotificationProps & INotificationConnectedProps, {}> {
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

  private renderNotification(notification: INotification) {
    return (<Notification key={notification.message} params={notification} onDismiss={(id) => undefined} />);
  }
}

function mapStateToProps(state: IState): INotificationConnectedProps {
  return {
    notifications: state.notifications.notifications,
  };
}

export default connect(mapStateToProps)(NotificationsBase) as React.ComponentClass<INotificationProps>;
