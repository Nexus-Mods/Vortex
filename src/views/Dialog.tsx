import { dismissDialog } from '../actions/notifications';
import { DialogType, IDialog } from '../types/IDialog';
import { IState } from '../types/IState';
import { ComponentEx, connect, translate } from '../util/ComponentEx';
import Icon from '../views/Icon';

import { Button } from './TooltipControls';

import * as React from 'react';
import { Modal } from 'react-bootstrap';

interface IDialogConnectedProps {
  dialogs: IDialog[];
}

interface IDialogActionProps {
  onDismiss: () => void;
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
          { dialog.message }
        </Modal.Body>
        <Modal.Footer>
          <Button tooltip={ t('Confirm') } id='close' onClick={ this.dismiss }>
            {t('Ok') }
          </Button>
        </Modal.Footer>
      </Modal>
    ) : null;
  }

  private iconForType(type: DialogType) {
    switch (type) {
      case 'info': return (
        <Icon name='info-circle' style={{ height: '32px', color: 'blue' }} />
      );
      case 'error': return (
        <Icon name='exclamation-circle' style={{ height: '32px', color: 'red' }} />
      );
      default: return null;
    }
  }

  private dismiss = () => {
    this.props.onDismiss();
  }
}

function mapStateToProps(state: IState): IDialogConnectedProps {
  return {
    dialogs: state.notifications.dialogs,
  };
}

function mapDispatchToProps<S>(dispatch: Redux.Dispatch<S>): IDialogActionProps {
  return {
    onDismiss: () => dispatch(dismissDialog()),
  };
}

export default translate(['common'], { wait: true })(
  connect(mapStateToProps, mapDispatchToProps)(Dialog)
) as React.ComponentClass<{}>;
