import { showDialog } from '../../../actions/notifications';
import Icon from '../../../controls/Icon';
import Spinner from '../../../controls/Spinner';
import { Button, IconButton } from '../../../controls/TooltipControls';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { UserCanceled } from '../../../util/CustomErrors';
import opn from '../../../util/opn';

import { setUserAPIKey } from '../actions/account';
import { setLoginId } from '../actions/session';
import { IValidateKeyData } from '../types/IValidateKeyData';
import { getPageURL } from '../util/sso';

import { clipboard } from 'electron';
import { TranslationFunction } from 'i18next';
import * as React from 'react';
import { ControlLabel, FormControl, FormGroup, InputGroup, Modal } from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

const API_ACCESS_URL = 'https://www.nexusmods.com/users/myaccount?tab=api+access';

export interface IBaseProps {
  visible: boolean;
  onHide: () => void;
  onCancelLogin: () => void;
}

interface IConnectedProps {
  APIKey: string;
  userInfo: IValidateKeyData;
  loginId: string;
}

interface IActionProps {
  onSetAPIKey: (APIKey: string) => void;
  onShowLoginError: (message: string) => void;
  onResetLoginId: () => void;
}

interface ILoginInProgressProps {
  t: TranslationFunction;
  loginId: string;
  onCopyToClipboard: () => void;
}

function LoginInProgress(props: ILoginInProgressProps) {
  const { t, loginId, onCopyToClipboard } = props;
  return (
    <form>
      <FormGroup>
        <ControlLabel>
          {t('Vortex should have opened the following url in your default browser. '
            + 'If that failed, please copy the url into your browser manually.')}
        </ControlLabel>
        <InputGroup>
          <FormControl
            type='text'
            value={getPageURL(loginId)}
            disabled={true}
          />
          <InputGroup.Addon>
            <IconButton
              className='btn-embed'
              icon='clipboard'
              tooltip={t('Copy to clipboard')}
              onClick={onCopyToClipboard}
            />
          </InputGroup.Addon>
        </InputGroup>
      </FormGroup>
    </form>
  );
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class LoginDialog extends ComponentEx<IProps, { troubleshoot: boolean, apiKeyInput: string }> {
  constructor(props: IProps) {
    super(props);

    this.initState({
      troubleshoot: false,
      apiKeyInput: '',
    });
  }

  public componentWillReceiveProps(newProps: IProps) {
    if (newProps.visible && !this.props.visible) {
      this.nextState.troubleshoot = false;
      this.nextState.apiKeyInput = '';
    }
  }

  public render(): JSX.Element {
    const { troubleshoot } = this.state;
    const { t, loginId, visible } = this.props;

    return (
      <Modal backdrop='static' id='login-dialog' show={visible || (loginId !== undefined)} onHide={this.hide}>
        <Modal.Body>
          <IconButton
            className='close-button'
            id='btn-close-login'
            onClick={this.close}
            tooltip={t('Close')}
            icon='close'
          />
          {
            troubleshoot
              ? this.renderTroubleshoot()
              : this.renderRegular()
          }
        </Modal.Body>
      </Modal>
    );
  }

  private renderRegular(): JSX.Element {
    const { t, loginId } = this.props;
    return (
      <div className='login-content'>
        <Icon
          className='nexus-header'
          name='nexus-header'
          svgStyle='#login-dialog path { fill: black }'
        />
        <div className='login-instructions'>
          {t('Please log in or register on the Nexus Mods website to log in on vortex!')}
        </div>
        {loginId !== undefined ? [
          <LoginInProgress
            key='login-in-progress'
            t={t}
            loginId={loginId}
            onCopyToClipboard={this.copyToClipboard}
          />,
          <Button
            key='troubleshoot-button'
            onClick={this.troubleshoot}
            tooltip={t('Use if the regular login doesn\'t work')}
          >
            {t('Troubleshoot')}
          </Button>,
        ] : null}
        <Button
          onClick={this.login}
          tooltip={t('Opens the Nexus Mods page in your default browser')}
          disabled={loginId !== undefined}
        >
          {(loginId !== undefined) ? (
            <div>
              <Spinner />
              {t('Please click "Authorise" on the website')}
            </div>
          ) : t('Log In On Website')}
        </Button>
      </div>
    );
  }

  private renderTroubleshoot() {
    const { apiKeyInput } = this.state;
    const { t } = this.props;
    return (
      <div className='login-content'>
        <Icon
          className='nexus-header'
          name='nexus-header'
          svgStyle='#login-dialog path { fill: black }'
        />
        <h3>
          {t('If you\'re having trouble logging in in the normal way, there is another way.')}
        </h3>
        <ul style={{ textAlign: 'left' }}>
          <li>
            {t('Open the Nexus Mods page and log in if you\'re not already.')}
          </li>
          <li>
            {t('Open this url:')}
            {' '}<a onClick={this.openApiAccess}>{API_ACCESS_URL}</a>{' '}
          </li>
          <li>
            {t('If there is a button "REQUEST AN API KEY" button alongside '
              + '"Vortex", click it.')}
          </li>
          <li>
            {t('You should now see a text field alongside Vortex with a long series of seemingly '
             + 'random characters (your API Key) with three buttons below it. '
             + 'Of these buttons, click the right-most one (Copy API Key).')}
          </li>
          <li>
            <FormControl
              componentClass='textarea'
              style={{display: 'inline'}}
              placeholder={t('Paste that api key into this input field')}
              value={apiKeyInput}
              onChange={this.updateAPIKey}
            />
          </li>
          <li>
            {t('Then press')}
            {' '}
            <Button
              onClick={this.applyKey}
              tooltip={t('Save API Key')}
            >
              {t('Save')}
            </Button>
          </li>
        </ul>
      </div>
    );
  }

  private renderConfirmDialog() {
    return this.context.api.showDialog('question', 'Login process unfinished', {
      text: 'Vortex is not logged in yet, are you sure you wish to cancel the login process ?',
    }, [
      { label: 'No' }, { label: 'Yes' }
    ]).then(result => {
      if (result.action === 'Yes') {
        this.hide();
      }
    });
  }

  private openApiAccess = () => {
    opn(API_ACCESS_URL).catch(() => null);
  }

  private hide = () => {
    const { onCancelLogin, onHide } = this.props;
    onCancelLogin();
    onHide();
  }

  private updateAPIKey = (evt: any) => {
    this.nextState.apiKeyInput = evt.target.value;
  }

  private applyKey = () => {
    const { apiKeyInput } = this.state;
    const { onHide, onResetLoginId, onSetAPIKey } = this.props;
    onSetAPIKey(apiKeyInput);
    onResetLoginId();
    onHide();
  }

  private close = () => {
    this.renderConfirmDialog();
  }

  private troubleshoot = () => {
    this.nextState.troubleshoot = true;
  }

  private copyToClipboard() {
    clipboard.writeText(getPageURL(this.props.loginId));
  }

  private login = () => {
    const { onHide } = this.props;
    this.context.api.events.emit('request-nexus-login', (err: Error) => {
      if ((err !== null) && !(err instanceof UserCanceled)) {
        this.context.api.showErrorNotification(
          'Failed to get access key', err, { allowReport: false });
      }
      onHide();
    });
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    APIKey: state.confidential.account.nexus.APIKey,
    userInfo: state.persistent.nexus.userInfo,
    loginId: state.session.nexus.loginId,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetAPIKey: (APIKey: string) => dispatch(setUserAPIKey(APIKey)),
    onShowLoginError:
    (message: string) => dispatch(showDialog('error', 'Error', { message },
                                             [ { label: 'Close' } ])),
    onResetLoginId: () => dispatch(setLoginId(undefined)),
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(
    translate(['common'], { wait: false })(
      LoginDialog)) as React.ComponentClass<IBaseProps>;
