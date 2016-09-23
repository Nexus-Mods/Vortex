import { dismissNotification } from '../actions/notifications';
import { INotification } from '../types/INotification';
import { IState } from '../types/IState';
import Notification from './Notification';

import * as React from 'react';
import { connect } from 'react-redux';

import CSSTransitionGroup = require('react-addons-css-transition-group');

interface IProps {
  id: string;
}

interface IConnectedProps {
  notifications: INotification[];
}

interface IActionProps {
  onDismiss: (id) => void;
}

class Notifications extends React.Component<IProps & IActionProps & IConnectedProps, {}> {
  constructor(props) {
    super(props);
  }

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
    const { onDismiss } = this.props;
    return <Notification key={notification.id} params={notification} onDismiss={onDismiss} />;
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    notifications: state.notifications.notifications,
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onDismiss: (id: string) => dispatch(dismissNotification(id)),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(
  Notifications) as React.ComponentClass<IProps>;
