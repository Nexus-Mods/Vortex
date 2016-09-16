import { dismissDialog } from '../actions/actions';
import { IDialog } from '../types/IDialog';
import { II18NProps } from '../types/II18NProps';
import { IState } from '../types/IState';

import { Button } from './TooltipControls';

import * as React from 'react';
import { Modal } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';

interface IDialogConnectedProps {
  dialogs: IDialog[];
}

interface IDialogActionProps {
  onDismiss: () => void;
}

class Dialog extends React.Component<IDialogConnectedProps & IDialogActionProps & II18NProps, {}> {
  public render(): JSX.Element {
    const { t, dialogs } = this.props;
    const dialog = dialogs.length > 0 ? dialogs[0] : undefined;
    return dialog !== undefined ? (
      <Modal show={dialog !== undefined} onHide={ this.dismiss }>
        <Modal.Header>
          <Modal.Title>{ t(dialog.title) }</Modal.Title>
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
