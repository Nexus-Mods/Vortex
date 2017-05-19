import { INotification, INotificationAction, NotificationType } from '../types/INotification';
import { ComponentEx } from '../util/ComponentEx';
import Icon from '../views/Icon';

import * as React from 'react';
import { Alert, Button } from 'react-bootstrap';

interface IActionProps {
  t: I18next.TranslationFunction;
  onDismiss: () => void;
}

class Action extends React.Component<IActionProps & INotificationAction, {}> {
  public render(): JSX.Element {
    const { t, title } = this.props;
    return <Button onClick={this.action}>{t(title)}</Button>;
  }

  private action = () => this.props.action(this.props.onDismiss);
}

export interface IProps {
  t: I18next.TranslationFunction;
  params: INotification;
  onDismiss: (id: string) => void;
}

class Notification extends ComponentEx<IProps, {}> {

  public render(): JSX.Element {
    const { actions, message, type } = this.props.params;

    const lines = message.split('\n');

    const styleName = this.typeToStyle(type);

    return (
      <Alert bsStyle={styleName} onDismiss={this.dismiss}>
        { this.typeToIcon(type) }{' '}
        { lines[0] }
        <p className='hover-expand'>
          { lines.slice(1).map((line, idx) => <span key={idx}>{line}</span>) }
        </p>
        <p>
          { actions !== undefined ? actions.map(this.renderAction) : null }
        </p>
      </Alert>
    );
  }

  private renderAction = (action) => {
    return (
      <Action
        key={action.title}
        t={this.props.t}
        title={action.title}
        action={action.action}
        onDismiss={this.dismiss}
      />
    );
  }

  private typeToStyle(type: NotificationType) {
    switch (type) {
      case 'success': return 'success';
      case 'activity': return 'info';
      case 'info': return 'info';
      case 'error': return 'danger';
      default: return 'warning';
    }
  }

  private typeToIcon(type: NotificationType): JSX.Element {
    switch (type) {
      case 'activity': return <Icon name='spinner' pulse />;
      default: return null;
    }
  }

  private dismiss = () => this.props.onDismiss(this.props.params.id);
}

export default Notification;
