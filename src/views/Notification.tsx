import { INotification, INotificationAction, NotificationType } from '../types/INotification';
import { ComponentEx, translate } from '../util/ComponentEx';

import * as React from 'react';
import { Alert, Button } from 'react-bootstrap';

interface IActionProps {
  t: (text: string) => string;
  onDismiss: () => void;
}

class Action extends React.Component<IActionProps & INotificationAction, {}> {
  public render(): JSX.Element {
    const { t, title } = this.props;
    return <Button onClick={this.action}>{t(title)}</Button>;
  }

  private action = () => this.props.action(this.props.onDismiss);
}

interface IProps {
  params: INotification;
  onDismiss: (id: string) => void;
}

class Notification extends ComponentEx<IProps, {}> {

  private styleName: string;

  constructor(props) {
    super(props);

    this.styleName = this.typeToStyle(props.params.type);
  }

  public render(): JSX.Element {
    let { actions, message } = this.props.params;
    return (
      <Alert bsStyle={this.styleName} onDismiss={this.dismiss}>
        {message}
        <p>
          { actions !== undefined ? actions.map(this.renderAction) : null }
        </p>
      </Alert>
    );
  }

  private renderAction = (action) => {
    return <Action
      key={action.title}
      t={this.props.t}
      title={action.title}
      action={action.action}
      onDismiss={this.dismiss}
    />;
  }

  private typeToStyle(type: NotificationType) {
    switch (type) {
      case 'success': return 'success';
      case 'info': return 'info';
      case 'error': return 'danger';
      default: return 'warning';
    }
  }

  private dismiss = () => this.props.onDismiss(this.props.params.id);
}

export default
  translate(['common'], { wait: true })(Notification) as React.ComponentClass<IProps>;
