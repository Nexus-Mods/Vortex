import { closeDialog } from '../actions/notifications';
import { DialogType, IDialog, IDialogContent } from '../types/IDialog';
import { IState } from '../types/IState';
import { ComponentEx, connect, translate } from '../util/ComponentEx';
import Icon from '../views/Icon';

import * as React from 'react';
import { Button, Modal } from 'react-bootstrap';

interface IActionProps {
  t: (input: string) => string;
  onDismiss: (action: string) => void;
  action: string;
}

class Action extends React.Component<IActionProps, {}> {
  public render(): JSX.Element {
    const { t, action } = this.props;
    return (
      <Button id='close' onClick={this.dismiss}>
        {t(action)}
      </Button>
    );
  }

  private dismiss = () => {
    const { onDismiss, action } = this.props;
    onDismiss(action);
  }
}

interface IDialogConnectedProps {
  dialogs: IDialog[];
}

interface IDialogActionProps {
  onDismiss: (id: string, action: string) => void;
}

class Dialog extends ComponentEx<IDialogConnectedProps & IDialogActionProps, {}> {
  public render(): JSX.Element {
    const { t, dialogs } = this.props;
    const dialog = dialogs.length > 0 ? dialogs[0] : undefined;
    return dialog !== undefined ? (
      <Modal show={dialog !== undefined} onHide={ this.dismiss }>
        <Modal.Header>
          <Modal.Title>{ this.iconForType(dialog.type) }{' '}{ t(dialog.title) }</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          { this.renderContent(dialog.content) }
        </Modal.Body>
        <Modal.Footer>
          { dialog.actions.map(this.renderAction) }
        </Modal.Footer>
      </Modal>
    ) : null;
  }

  private renderContent(content: IDialogContent): JSX.Element {
    const { t } = this.props;
    if (content.message !== undefined) {
      return <div>{ t(content.message) }</div>;
    } else if (content.htmlFile !== undefined) {
      return <webview src={`file://${content.htmlFile}`} />;
    } else {
      return null;
    }
  }

  private renderAction = (action: string): JSX.Element => {
    const { t } = this.props;
    return (
      <Action t={t} key={action} action={action} onDismiss={this.dismiss} />
    );
  }

  private iconForType(type: DialogType) {
    switch (type) {
      case 'info': return (
        <Icon name='info-circle' style={{ height: '32px', width: '32px', color: 'blue' }} />
      );
      case 'error': return (
        <Icon name='exclamation-circle' style={{ height: '32px', width: '32px', color: 'red' }} />
      );
      case 'question': return (
        <Icon name='question-circle' style={{ height: '32px', width: '32px', color: 'blue' }} />
      );
      default: return null;
    }
  }

  private dismiss = (action: string) => {
    const { dialogs } = this.props;
    this.props.onDismiss(dialogs[0].id, action);
  }
}

function mapStateToProps(state: IState): IDialogConnectedProps {
  return {
    dialogs: state.notifications.dialogs,
  };
}

function mapDispatchToProps<S>(dispatch: Redux.Dispatch<S>): IDialogActionProps {
  return {
    onDismiss: (id: string, action: string) => dispatch(closeDialog(id, action, null)),
  };
}

export default translate(['common'], { wait: false })(
  connect(mapStateToProps, mapDispatchToProps)(Dialog)
) as React.ComponentClass<{}>;
