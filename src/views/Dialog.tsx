import { closeDialog } from '../actions/notifications';
import Icon from '../controls/Icon';
import {
  DialogType, ICheckbox, IDialog,
  IDialogContent, IInput,
} from '../types/IDialog';
import { IState } from '../types/IState';
import bbcode from '../util/bbcode';
import { ComponentEx, connect, translate } from '../util/ComponentEx';

import * as I18next from 'i18next';
import * as update from 'immutability-helper';
import * as React from 'react';
import {
  Button, Checkbox, ControlLabel, FormControl, FormGroup,
  Modal, Radio,
} from 'react-bootstrap';
import * as ReactDOM from 'react-dom';
import * as Redux from 'redux';

interface IActionProps {
  t: (input: string) => string;
  onDismiss: (action: string) => void;
  action: string;
  isDefault: boolean;
}

class Action extends React.Component<IActionProps, {}> {
  public render(): JSX.Element {
    const { t, action, isDefault } = this.props;
    return (
      <Button
        id='close'
        onClick={this.dismiss}
        bsStyle={isDefault ? 'primary' : undefined}
        ref={isDefault ? this.focus : undefined}
      >
        {t(action)}
      </Button>
    );
  }

  private focus = ref => {
    if (ref !== null) {
      (ReactDOM.findDOMNode(ref) as HTMLElement).focus();
    }
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

  public componentWillMount() {
    if (this.props.dialogs.length > 0) {
      this.setState(update(this.state, {
        currentDialogId: { $set: this.props.dialogs[0].id },
        dialogState: { $set: this.props.dialogs[0].content },
      }));
    }
  }

  public render(): JSX.Element {
    const { t, dialogs } = this.props;
    const { dialogState } = this.state;

    const dialog = dialogs.length > 0 ? dialogs[0] : undefined;

    if ((dialog === undefined) || (dialogState === undefined)) {
      return null;
    }

    const type = (dialog.content.htmlFile !== undefined) || (dialog.content.htmlText !== undefined)
      ? 'wide'
      : 'regular';
    return dialog !== undefined ? (
      <Modal className={`common-dialog-${type}`} show={dialog !== undefined} onHide={this.dismiss}>
        <Modal.Header>
          <Modal.Title>{this.iconForType(dialog.type)}{' '}{t(dialog.title)}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {this.renderContent(dialogState)}
        </Modal.Body>
        <Modal.Footer>
          {
            dialog.actions.map((action) =>
              this.renderAction(action, action === dialog.defaultAction))
          }
        </Modal.Footer>
      </Modal>
    ) : null;
  }

  private translateParts(message: string, t: I18next.TranslationFunction) {
    // split by linebreak, then by tab, apply translation function, then join
    // again (replacing tabs with spaces)
    return message
      .split('\n')
      .map((line: string) => line
        .split('\t')
        .map((block: string) => t(block))
        .join(' '))
      .join('\n');
  }

  private renderContent(content: IDialogContent): JSX.Element {
    let { t } = this.props;
    if (content.options && content.options.translated) {
      t = (input: any) => input;
    }

    const controls: JSX.Element[] = [];

    if (content.message !== undefined) {
      const wrap = (content.options && (content.options.wrap === true)) ? 'on' : 'off';
      controls.push((
        <textarea
          key='dialog-content-message'
          wrap={wrap}
          defaultValue={this.translateParts(content.message, t)}
          readOnly={true}
        />
      ));
    }

    if (content.htmlFile !== undefined) {
      controls.push((
        <div key='dialog-content-html'>
          <webview src={`file://${content.htmlFile}`} />
        </div>
      ));
    } else if (content.bbcode !== undefined) {
      controls.push((
        <div key='dialog-content-bbcode'>
          {bbcode(content.bbcode)}
        </div>
      ));
    } else if (content.htmlText !== undefined) {
      controls.push((
        <div
          key='dialog-content-html'
          dangerouslySetInnerHTML={{ __html: content.htmlText }}
        />
      ));
    } else if (content.checkboxes !== undefined) {
      controls.push((
        <div key='dialog-content-choices'>
          {content.checkboxes.map(this.renderCheckbox)}
        </div>
      ));
    } else if (content.choices !== undefined) {
      controls.push((
        <div key='dialog-content-choices'>
          {content.choices.map(this.renderRadiobutton)}
        </div>
      ));
    } else if (content.input !== undefined) {
      controls.push((
      <div key='dialog-form-content'>
        {content.input.map(this.renderInput)}
      </div>
      ));
    }

    return <div className='dialog-container'>{controls}</div>;
  }

  private renderInput = (input: IInput) => {
    const { t } = this.props;
    return (
      <FormGroup key={input.id}>
      { input.label ? (
        <ControlLabel>{t(input.label)}</ControlLabel>
      ) : null }
      <FormControl
        id={`dialoginput-${input.id}`}
        type={input.type || 'text'}
        value={input.value || ''}
        label={input.label}
        placeholder={input.placeholder}
        onChange={this.changeInput}
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

  private changeInput = evt => {
    const { dialogState } = this.state;

    const id = evt.currentTarget.id.split('-').slice(1).join('-');

    const idx = dialogState.input.findIndex(
      form => form.id === id);

    const newInput = { ...dialogState.input[idx] };
    newInput.value = evt.currentTarget.value;

    this.setState(update(this.state, {
      dialogState: {
        input: { $splice: [[idx, 1, newInput]] },
      },
    }));
  }

  private toggleCheckbox = (evt: React.MouseEvent<any>) => {
    const { dialogState } = this.state;
    const idx = dialogState.checkboxes.findIndex((box: ICheckbox) => {
      return box.id === evt.currentTarget.id;
    });

    const newCheckboxes = dialogState.checkboxes.slice(0);
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

    const newChoices = dialogState.choices.map((choice: ICheckbox) =>
      ({ id: choice.id, text: choice.text, value: false }));
    newChoices[idx].value = true;

    this.setState(update(this.state, {
      dialogState: {
        choices: { $set: newChoices },
      },
    }));
  }

  private renderAction = (action: string, isDefault: boolean): JSX.Element => {
    const { t } = this.props;
    return (
      <Action t={t} key={action} action={action} isDefault={isDefault} onDismiss={this.dismiss} />
    );
  }

  private iconForType(type: DialogType) {
    switch (type) {
      case 'info': return (
        <Icon name='circle-info' className='icon-info'/>
      );
      case 'error': return (
        <Icon name='circle-exclamation' className='icon-error'/>
      );
      case 'question': return (
        <Icon name='circle-question' className='icon-question'/>
      );
      default: return null;
    }
  }

  private dismiss = (action: string) => {
    const { dialogs, onDismiss } = this.props;
    const { dialogState } = this.state;

    const data = {};
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

    if (dialogState.input !== undefined) {
      dialogState.input.forEach(input => {
        data[input.id] = input.value;
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
  connect(mapStateToProps, mapDispatchToProps)(
    Dialog)) as React.ComponentClass<{}>;
