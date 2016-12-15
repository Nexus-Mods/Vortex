import { closeDialog } from '../actions/notifications';
import { DialogType, ICheckbox, IDialog, IDialogContent, IFormControl } from '../types/IDialog';
import { IState } from '../types/IState';
import { ComponentEx, connect, translate } from '../util/ComponentEx';
import Icon from '../views/Icon';

import * as React from 'react';
import update = require('react-addons-update');
import { Button, Checkbox, FormControl, Modal } from 'react-bootstrap';

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
  onDismiss: (id: string, action: string, input: IDialogContent) => void;
}

interface IComponentState {
  currentDialogId: string;
  dialogState: IDialogContent;
}

type IProps = IDialogConnectedProps & IDialogActionProps;

class Dialog extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);

    this.state = {
      currentDialogId: undefined,
      dialogState: undefined,
    };
  }

  public componentWillReceiveProps(newProps: IProps) {
    if ((newProps.dialogs.length > 0) &&
      (newProps.dialogs[0].id !== this.state.currentDialogId)) {
      this.setState(update(this.state, {
        currentDialogId: { $set: newProps.dialogs[0].id },
        dialogState: { $set: newProps.dialogs[0].content },
      }));
    }
  }

  public render(): JSX.Element {
    const { t, dialogs } = this.props;
    const { dialogState } = this.state;
    const dialog = dialogs.length > 0 ? dialogs[0] : undefined;
    return dialog !== undefined ? (
      <Modal show={dialog !== undefined} onHide={this.dismiss}>
        <Modal.Header>
          <Modal.Title>{this.iconForType(dialog.type)}{' '}{t(dialog.title)}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {this.renderContent(dialogState)}
        </Modal.Body>
        <Modal.Footer>
          {dialog.actions.map(this.renderAction)}
        </Modal.Footer>
      </Modal>
    ) : null;
  }

  private renderContent(content: IDialogContent): JSX.Element {
    const { t } = this.props;
    if (content.message !== undefined) {
      return <div>{t(content.message)}</div>;
    } else if (content.htmlFile !== undefined) {
      return <webview src={`file://${content.htmlFile}`} />;
    } else if (content.checkboxes !== undefined) {
      return (
        <div>
          {content.checkboxes.map(this.renderCheckbox)}
        </div>
      );
    } else if (content.formcontrol !== undefined) {
      return (
        <div>
          {this.renderFormControl(content.formcontrol)}
        </div>
      );
    } else {
      return null;
    }
  }

  private renderFormControl = (formcontrol: IFormControl) => {
    return (
      <FormControl
        id={formcontrol.id}
        type={formcontrol.type}
        value={formcontrol.value}
        onChange={this.toggleFormControl}
      />
    );
  }

  private renderCheckbox = (checkbox: ICheckbox) => {
    const { t } = this.props;
    return (
      <Checkbox id={checkbox.id} checked={checkbox.value} onClick={this.toggleCheckbox}>
        {t(checkbox.text)}
      </Checkbox>
    );
  }

  private toggleFormControl = (evt) => {
    let { dialogState } = this.state;
    let newFormControl = dialogState.formcontrol;
    newFormControl.value = evt.currentTarget.value;

    this.setState(update(this.state, {
      dialogState: {
        formcontrol: {  $set: newFormControl },
      },
    }));
  }

  private toggleCheckbox = (evt) => {
    let { dialogState } = this.state;
    let idx = dialogState.checkboxes.findIndex((box: ICheckbox) => {
      return box.id === evt.currentTarget.id;
    });

    let newCheckboxes = dialogState.checkboxes.slice(0);
    newCheckboxes[idx].value = !newCheckboxes[idx].value;

    this.setState(update(this.state, {
      dialogState: {
        checkboxes: { $set: newCheckboxes },
      },
    }));
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
    const { dialogs, onDismiss } = this.props;
    const { dialogState } = this.state;

    let data = null;
    if (dialogState.checkboxes !== undefined) {
      data = {};
      dialogState.checkboxes.forEach((box: ICheckbox) => {
        data[box.id] = box.value;
      });
    } else if (dialogState.formcontrol !== undefined) {
      data = dialogState.formcontrol;
    }
    onDismiss(dialogs[0].id, action, data);
  }
}

function mapStateToProps(state: IState): IDialogConnectedProps {
  return {
    dialogs: state.notifications.dialogs,
  };
}

function mapDispatchToProps<S>(dispatch: Redux.Dispatch<S>): IDialogActionProps {
  return {
    onDismiss: (id: string, action: string, input: any) =>
      dispatch(closeDialog(id, action, input)),
  };
}

export default translate(['common'], { wait: false })(
  connect(mapStateToProps, mapDispatchToProps)(Dialog)
) as React.ComponentClass<{}>;
