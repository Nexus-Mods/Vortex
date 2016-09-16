import { II18NProps } from '../types/II18NProps';
import { INotification, INotificationAction, INotificationType } from '../types/INotification';

import * as React from 'react';
import { Alert, Button } from 'react-bootstrap';
import { translate } from 'react-i18next';

interface INotificationProps {
  params: INotification;
  onDismiss: (id: string) => void;
}

class Notification extends React.Component<INotificationProps & II18NProps, {}> {

  private styleName: string;

  constructor(props) {
    super(props);

    this.styleName = this.typeToStyle(props.params.type);
  }

  public render(): JSX.Element {
    let { actions, message } = this.props.params;
    return (
      <Alert bsStyle={this.styleName}>
        {message}
        <div>{actions.map(this.renderAction)}</div>
      </Alert>
    );
  }

  private renderAction = (action: INotificationAction) => this.renderActionImpl(action);

  private renderActionImpl(action: INotificationAction) {
    let { t, onDismiss } = this.props;
    let { id } = this.props.params;
    const dismissFunc = () => onDismiss(id);
    return <Button onClick={() => action.action(dismissFunc)}>{t(action.title)}</Button>;
  }

  private typeToStyle(type: INotificationType) {
    switch (type) {
      case 'success': return 'success';
      case 'info': return 'info';
      case 'error': return 'danger';
      default: return 'warning';
    }
  }
}

export default translate(['common'], { wait: true })(Notification);
