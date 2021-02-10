import { ILink, triggerDialogLink } from '../actions';
import { closeDialog } from '../actions/notifications';
import Collapse from '../controls/Collapse';
import ErrorBoundary, { ErrorContext } from '../controls/ErrorBoundary';
import Icon from '../controls/Icon';
import Webview from '../controls/Webview';
import {
  ConditionResults, DialogType, ICheckbox, IConditionResult, IDialog,
  IDialogContent, IInput,
} from '../types/IDialog';
import { IState } from '../types/IState';
import bbcode from '../util/bbcode';
import { ComponentEx, connect, translate } from '../util/ComponentEx';
import { TFunction } from '../util/i18n';

import { remote } from 'electron';
import update from 'immutability-helper';
import * as React from 'react';
import {
  Button, Checkbox, ControlLabel, FormControl, FormGroup,
  Modal, Radio,
} from 'react-bootstrap';
import * as ReactDOM from 'react-dom';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

const nop = () => undefined;

interface IActionProps {
  t: (input: string) => string;
  onDismiss: (action: string) => void;
  action: string;
  isDefault: boolean;
  isDisabled: boolean;
}

class Action extends React.Component<IActionProps, {}> {
  public render(): JSX.Element {
    const { t, action, isDefault, isDisabled } = this.props;
    return (
      <Button
        id='close'
        onClick={this.dismiss}
        bsStyle={isDefault ? 'primary' : undefined}
        ref={isDefault ? this.focus : undefined}
        disabled={isDisabled}
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
  conditionResults: ConditionResults;
}

type IProps = IDialogConnectedProps & IDialogActionProps;

class Dialog extends ComponentEx<IProps, IComponentState> {
  public static contextType = ErrorContext;

  constructor(props: IProps) {
    super(props);

    this.state = {
      currentDialogId: undefined,
      dialogState: undefined,
      conditionResults: [],
    };
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if ((newProps.dialogs.length > 0) &&
      (newProps.dialogs[0].id !== this.state.currentDialogId)) {
      let newState = update(this.state, {
        currentDialogId: { $set: newProps.dialogs[0].id },
        dialogState: { $set: newProps.dialogs[0].content },
      });

      const validationResults = this.validateContent(newState.dialogState);
      if (validationResults !== undefined) {
        newState = {...newState, conditionResults: validationResults};
      }

      this.setState(newState);

      const window = remote.getCurrentWindow();
      if (window.isMinimized()) {
        window.restore();
      }
      window.setAlwaysOnTop(true);
      window.show();
      window.setAlwaysOnTop(false);
    }
  }

  public componentDidMount() {
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
    return (
      <Modal
        className={`common-dialog-${type}`}
        show={dialog !== undefined}
        onHide={nop}
        onKeyPress={this.handleKeyPress}
      >
        <Modal.Header>
          <Modal.Title>{this.iconForType(dialog.type)}{' '}{t(dialog.title)}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ErrorBoundary visible={true}>
            {this.renderContent(dialogState)}
          </ErrorBoundary>
        </Modal.Body>
        <Modal.Footer>
          {
            dialog.actions.map((action) =>
              this.renderAction(action, action === dialog.defaultAction))
          }
        </Modal.Footer>
      </Modal>
    );
  }

  private translateParts(message: string, t: TFunction, parameters?: any) {
    // split by linebreak, then by tab, apply translation function, then join
    // again (replacing tabs with spaces)
    return (message || '')
      .split('\n')
      .map((line: string) => line
        .split('\t')
        .map((block: string) => t(block, { replace: parameters }))
        .join(' '))
      .join('\n');
  }

  private renderContent(content: IDialogContent): JSX.Element {
    let { t } = this.props;
    if (content.options?.translated) {
      // t = (input: string, options) => this.props.t(input, { ...options, lng: 'en' });
      t = (input: any) => input;
    }

    const controls: JSX.Element[] = [];

    if (content.text) {
      controls.push((
        <div key='dialog-content-text' className='dialog-content-text'>
          {t(content.text, { replace: content.parameters })}
        </div>
      ));
    }

    if (content.bbcode !== undefined) {
      controls.push((
        <div key='dialog-content-bbcode' className='dialog-content-bbcode'>
          {bbcode(t(content.bbcode, { replace: content.parameters }),
            content.options?.bbcodeContext)}
        </div>
      ));
    }

    if (content.message !== undefined) {
      const wrap = ((content.options !== undefined) && (content.options.wrap === true))
                 ? 'on' : 'off';
      const ctrl = (
        <textarea
          key='dialog-content-message'
          wrap={wrap}
          value={this.translateParts(content.message, t, content.parameters)}
          readOnly={true}
        />
      );
      if ((content.options !== undefined) && (content.options.hideMessage === true)) {
        controls.push((
          <Collapse
            key='dialog-content-message-wrapper'
            showText={t('Show Details')}
            hideText={t('Hide Details')}
          >
            {ctrl}
          </Collapse>
          ));
      } else {
        controls.push(ctrl);
      }
    }

    if (content.htmlFile !== undefined) {
      controls.push((
        <div key='dialog-content-html-file'>
          <Webview src={`file://${content.htmlFile}`} />
        </div>
      ));
    }

    if (content.htmlText !== undefined) {
      controls.push((
        <div
          key='dialog-content-html-text'
          className='dialog-content-html'
          dangerouslySetInnerHTML={{ __html: content.htmlText }}
        />
      ));
    }

    if (content.checkboxes !== undefined) {
      controls.push((
        <div key='dialog-content-checkboxes' className='dialog-content-choices'>
          <div>
            {content.checkboxes.map(this.renderCheckbox)}
          </div>
        </div>
      ));
    }

    if (content.choices !== undefined) {
      controls.push((
        <div key='dialog-content-choices' className='dialog-content-choices'>
          <div>
            {content.choices.map(this.renderRadiobutton)}
          </div>
        </div>
      ));
    }

    if (content.links !== undefined) {
      controls.push((
        <div key='dialog-form-links'>
          {content.links.map(this.renderLink)}
        </div>
      ));
    }

    if (content.input !== undefined) {
      controls.push((
      <div key='dialog-form-content' className='dialog-content-input'>
        {content.input.map(this.renderInput)}
      </div>
      ));
    }

    return <div className='dialog-container'>{controls}</div>;
  }

  private handleKeyPress = (evt: React.KeyboardEvent<Modal>) => {
    const { conditionResults } = this.state;

    if (!evt.defaultPrevented) {
      const { dialogs } = this.props;
      const dialog = dialogs[0];
      if (evt.key === 'Enter') {
        if (dialog.defaultAction !== undefined) {
          evt.preventDefault();

          const filterFunc = res =>
            res.actions.find(act => act === dialog.defaultAction) !== undefined;
          const isDisabled = conditionResults.find(filterFunc) !== undefined;
          if (!isDisabled) {
            this.dismiss(dialog.defaultAction);
          }
        }
      }
    }
  }

  private validateContent(dialogState: IDialogContent): ConditionResults {
    const { conditionResults } = this.state;
    if ((conditionResults === undefined) || (dialogState.condition === undefined)) {
      return undefined;
    }

    return dialogState.condition(dialogState);
  }

  private getValidationResult(input: IInput): IConditionResult[] {
    const { conditionResults } = this.state;
    return conditionResults.filter(res => res.id === input.id);
  }

  private renderInput = (input: IInput, idx: number) => {
    const { t } = this.props;
    const { dialogState } = this.state;
    let valRes: IConditionResult[];
    if (dialogState.condition !== undefined) {
      valRes = this.getValidationResult(input);
    }

    const validationState = valRes !== undefined
        ? (valRes.length !== 0) ? 'error' : 'success'
        : null;

    let effectiveType = input.type || 'text';
    if (input.type === 'multiline') {
      effectiveType = 'text';
    }

    return (
      <FormGroup key={input.id} validationState={validationState}>
      { input.label ? (
        <ControlLabel>{t(input.label)}</ControlLabel>
      ) : null }
      <FormControl
        id={`dialoginput-${input.id}`}
        componentClass={(input.type === 'multiline') ? 'textarea' : undefined}
        type={effectiveType}
        value={input.value || ''}
        label={input.label}
        placeholder={input.placeholder}
        onChange={this.changeInput}
        ref={idx === 0 ? this.focusMe : undefined}
      />
      {((valRes !== undefined) && (valRes.length !== 0))
        ? <label className='control-label'>{valRes.map(res => res.errorText).join('\n')}</label>
        : null}
      </FormGroup>
    );
  }

  private renderLink = (link: ILink, idx: number) => {
    return (
      <div key={idx}>
        <a onClick={this.triggerLink} data-linkidx={idx}>{link.label}</a>
      </div>
    );
  }

  private triggerLink = (evt: React.MouseEvent<any>) => {
    evt.preventDefault();
    triggerDialogLink(this.props.dialogs[0].id, evt.currentTarget.getAttribute('data-linkidx'));
  }

  private renderCheckbox = (checkbox: ICheckbox) => {
    const { t } = this.props;
    return (
      <Checkbox
        id={checkbox.id}
        key={checkbox.id}
        checked={checkbox.value}
        onChange={this.toggleCheckbox}
        disabled={checkbox.disabled}
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
        disabled={checkbox.disabled}
      >
        {t(checkbox.text)}
      </Radio>
    );
  }

  private focusMe = (ref: React.ReactInstance) => {
    if (ref !== null) {
      const ele = ReactDOM.findDOMNode(ref) as HTMLElement;
      setTimeout(() => ele.focus(), 100);
    }
  }

  private changeInput = evt => {
    const { dialogState } = this.state;

    const id = evt.currentTarget.id.split('-').slice(1).join('-');

    const idx = dialogState.input.findIndex(
      form => form.id === id);

    const newInput = { ...dialogState.input[idx] };
    newInput.value = evt.currentTarget.value;

    let newState = update(this.state, {
      dialogState: {
        input: { $splice: [[idx, 1, newInput]] },
      },
    });

    const validationResults = this.validateContent(newState.dialogState);
    if (validationResults !== undefined) {
      newState = {...newState, conditionResults: validationResults};
    }

    this.setState(newState);
  }

  private toggleCheckbox = (evt: React.MouseEvent<any>) => {
    const { dialogState } = this.state;
    const idx = dialogState.checkboxes.findIndex((box: ICheckbox) => {
      return box.id === evt.currentTarget.id;
    });

    const newCheckboxes = JSON.parse(JSON.stringify(dialogState.checkboxes.slice(0)));
    newCheckboxes[idx].value = !newCheckboxes[idx].value;

    let newState = update(this.state, {
      dialogState: {
        checkboxes: { $set: newCheckboxes },
      },
    });

    const validationResults = this.validateContent(newState.dialogState);
    if (validationResults !== undefined) {
      newState = {...newState, conditionResults: validationResults};
    }

    this.setState(newState);
  }

  private toggleRadio = (evt: React.MouseEvent<any>) => {
    const { dialogState } = this.state;
    const idx = dialogState.choices.findIndex((box: ICheckbox) => {
      return box.id === evt.currentTarget.id;
    });

    const newChoices = dialogState.choices.map((choice: ICheckbox) =>
      ({ id: choice.id, text: choice.text, value: false }));
    newChoices[idx].value = true;

    let newState = update(this.state, {
      dialogState: {
        choices: { $set: newChoices },
      },
    });

    const validationResults = this.validateContent(newState.dialogState);
    if (validationResults !== undefined) {
      newState = {...newState, conditionResults: validationResults};
    }

    this.setState(newState);
  }

  private renderAction = (action: string, isDefault: boolean): JSX.Element => {
    const { conditionResults } = this.state;
    const { t } = this.props;
    const isDisabled = conditionResults
      .find(res => res.actions.find(act => act === action) !== undefined) !== undefined;
    return (
      <Action
        t={t}
        key={action}
        action={action}
        isDefault={isDefault}
        onDismiss={this.dismiss}
        isDisabled={isDisabled}
      />
      );
  }

  private iconForType(type: DialogType) {
    switch (type) {
      case 'info': return (
        <Icon name='dialog-info' className='icon-info'/>
      );
      case 'error': return (
        <Icon name='dialog-error' className='icon-error'/>
      );
      case 'question': return (
        <Icon name='dialog-question' className='icon-question'/>
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

function mapDispatchToProps<S>(dispatch: ThunkDispatch<S, null, Redux.Action>): IDialogActionProps {
  return {
    onDismiss: (id: string, action: string, input: any) =>
      dispatch(closeDialog(id, action, input)),
  };
}

export default translate(['common'])(
  connect(mapStateToProps, mapDispatchToProps)(
    Dialog)) as React.ComponentClass<{}>;
