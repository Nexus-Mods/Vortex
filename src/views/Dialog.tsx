import { closeDialog } from '../actions/notifications';
import {
  DialogType, ICheckbox, IDialog,
  IDialogContent, IFormControl,
} from '../types/IDialog';
import { IState } from '../types/IState';
import { ComponentEx, connect, translate } from '../util/ComponentEx';
import Icon from '../views/Icon';

import * as React from 'react';
import update = require('react-addons-update');
import {
  Button, Checkbox, ControlLabel, FormControl, FormGroup,
  Modal, Radio,
} from 'react-bootstrap';

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
    let { t } = this.props;
    if (content.options && content.options.translated) {
      t = (input: string) => input;
    }

    let controls: JSX.Element[] = [];

    let wrap = (content.options && !content.options.wrap) ? 'off' : 'on';

    if (content.message !== undefined) {
      controls.push(<textarea
        key='dialog-content-message'
        wrap={wrap}
        style={{ width: '100%', minHeight: 300, resize: 'none', border: 'none' }}
        defaultValue={content.message}
      />);
    }

    if (content.htmlFile !== undefined) {
      controls.push(<div key='dialog-content-html'>
        <webview src={`file://${content.htmlFile}`} />
      </div>);
    } else if (content.htmlText !== undefined) {
      controls.push(<div
        key='dialog-content-html'
        dangerouslySetInnerHTML={{ __html: content.htmlText }}
      />);
    } else if (content.checkboxes !== undefined) {
      controls.push(<div key='dialog-content-choices'>
        {content.checkboxes.map(this.renderCheckbox)}
      </div>
      );
    } else if (content.choices !== undefined) {
      controls.push(<div key='dialog-content-choices'>
        {content.choices.map(this.renderRadiobutton)}
      </div>);
    } else if (content.formcontrol !== undefined) {
      controls.push(<div key='dialog-form-content'>
        {content.formcontrol.map(this.renderFormControl)}
      </div>
      );
    }

    return <div style={{ width: '100%' }}>{controls}</div>;
  }

  private renderFormControl = (formcontrol: IFormControl) => {
    const { t } = this.props;
    return (
      <FormGroup key={formcontrol.id}>
        <ControlLabel>{t(formcontrol.label)}
        </ControlLabel>
        <FormControl
          id={formcontrol.id}
          key={formcontrol.id}
          type={formcontrol.type}
          value={formcontrol.value}
          label={formcontrol.label}
          onChange={this.toggleFormControl}
        />
      </FormGroup>
    );
  }

  private renderCheckbox = (checkbox: ICheckbox) => {
    const { t } = this.props;
    return (
      <Checkbox
        id={checkbox.id}
        key={checkbox.id}
        checked={checkbox.value}
        onChange={this.toggleCheckbox}
      >
        {t(checkbox.text)}
      </Checkbox>
    );
  }

  private renderRadiobutton = (checkbox: ICheckbox) => {
    const { t } = this.props;
    return (
      <Radio
        id={checkbox.id}
        key={checkbox.id}
        name='dialog-radio'
        checked={checkbox.value}
        onChange={this.toggleRadio}
      >
        {t(checkbox.text)}
      </Radio>
    );
  }

  private toggleFormControl = (evt) => {
    let { dialogState } = this.state;

    let idx = dialogState.formcontrol.findIndex((form: IFormControl) => {
      return form.id === evt.currentTarget.id;
    });

    let newFormControl = dialogState.formcontrol.slice(0);
    newFormControl[idx].value = evt.currentTarget.value;

    this.setState(update(this.state, {
      dialogState: {
        formcontrol: { $set: newFormControl },
      },
    }));
  }

  private toggleCheckbox = (evt: React.MouseEvent<any>) => {
    const { dialogState } = this.state;
    const idx = dialogState.checkboxes.findIndex((box: ICheckbox) => {
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

  private toggleRadio = (evt: React.MouseEvent<any>) => {
    const { dialogState } = this.state;
    const idx = dialogState.choices.findIndex((box: ICheckbox) => {
      return box.id === evt.currentTarget.id;
    });

    let newChoices = dialogState.choices.map((choice: ICheckbox) =>
      ({ id: choice.id, text: choice.text, value: false }));
    newChoices[idx].value = true;

    this.setState(update(this.state, {
      dialogState: {
        choices: { $set: newChoices },
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

    let data = {};
    if (dialogState.checkboxes !== undefined) {
      dialogState.checkboxes.forEach((box: ICheckbox) => {
        data[box.id] = box.value;
      });
    }

    if (dialogState.choices !== undefined) {
      dialogState.choices.forEach((box: ICheckbox) => {
        data[box.id] = box.value;
      });
    }

    if (dialogState.formcontrol !== undefined) {
      dialogState.formcontrol.forEach((form: IFormControl) => {
        data[form.id] = form.value;
      });
    }

    onDismiss(dialogs[0].id, action, data);
  }
}

function mapStateToProps(state: IState): IDialogConnectedProps {
  return {
    dialogs: state.session.notifications.dialogs,
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
