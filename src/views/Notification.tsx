import Icon from '../controls/Icon';
import { INotification, INotificationAction, NotificationType } from '../types/INotification';
import { ComponentEx } from '../util/ComponentEx';

import * as I18next from 'i18next';
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
    const { t } = this.props;
    const { actions, message, noDismiss, type } = this.props.params;

    const lines = message.split('\n');

    const styleName = this.typeToStyle(type);

    return (
      <div role='alert' className={`notification alert-${styleName}`} >
        {this.typeToIcon(type)}{' '}
        <p className='hover-expand'>
          {lines.map((line, idx) => <span key={idx}>{line}</span>)}
        </p>
        <div className='notification-buttons'>
          {actions !== undefined ? actions.map(this.renderAction) : null}
          {!noDismiss ? <Button onClick={this.dismiss}>{t('Dismiss')}</Button> : null}
        </div>
      </div>
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
      case 'warning': return 'warning';
      case 'error': return 'danger';
      default: return 'warning';
    }
  }

  private typeToIcon(type: NotificationType): JSX.Element {
    switch (type) {
      case 'activity': return <Icon name='spinner' pulse />;
      case 'success': return <Icon name='square-check' />;
      case 'info': return <Icon name='square-info' />;
      case 'warning': return <Icon name='square-exclamation' />;
      case 'error': return <Icon name='triangle-alert' />;
      default: return null;
    }
  }

  private dismiss = () => this.props.onDismiss(this.props.params.id);
}

export default Notification;
