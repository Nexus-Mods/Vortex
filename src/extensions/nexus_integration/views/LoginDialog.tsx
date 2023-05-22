import { IsValidNewOptionHandler } from 'react-select';
import { showDialog } from '../../../actions/notifications';
import ContextMenu from '../../../controls/ContextMenu';
import FormFeedback from '../../../controls/FormFeedback';
import Icon from '../../../controls/Icon';
import Modal from '../../../controls/Modal';
import Spinner from '../../../controls/Spinner';
import CopyClipboardInput from '../../../controls/CopyClipboardInput';
import PlaceholderTextArea from '../../../controls/PlaceholderTextArea';
import { Button, IconButton } from '../../../controls/TooltipControls';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { UserCanceled } from '../../../util/CustomErrors';
import { log } from '../../../util/log';
import opn from '../../../util/opn';

import { setUserAPIKey } from '../actions/account';
import { setLoginId, setOauthPending } from '../actions/session';
import { NEXUS_BASE_URL } from '../constants';
import { OAUTH_URL } from '../constants';
import { IValidateKeyData } from '../types/IValidateKeyData';
import { getPageURL } from '../util/sso';

import { clipboard } from 'electron';
import { TFunction } from 'i18next';
import * as React from 'react';
import { Alert, ControlLabel, FormControl, FormGroup,
         InputGroup,
         ModalBody } from 'react-bootstrap';
import { findDOMNode } from 'react-dom';
import { WithTranslation } from 'react-i18next';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

const API_ACCESS_URL = `${NEXUS_BASE_URL}/users/myaccount?tab=api+access`;



export interface IBaseProps extends WithTranslation {
  visible: boolean;
  onReceiveCode: (code: string, state?: string) => Promise<void>;
  onHide: () => void;
  onCancelLogin: () => void;
}

interface IConnectedProps {
  userInfo: IValidateKeyData;
  loginId: string;
  loginError: string;
  oauthPending: string;
}

interface IActionProps {
  onSetAPIKey: (APIKey: string) => void;
  onShowLoginError: (message: string) => void;
  onResetLoginId: () => void;
  onResetOauthPending: () => void;
}

interface ILoginInProgressProps {
  t: TFunction;
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

function nop() {
  // nop
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

interface ILoginDialogState {
  troubleshoot: boolean;
  apiKeyInput: string;
  requested: boolean;
  context: { x: number, y: number };
  showElement: boolean;
  invalidToken: boolean;
}

class LoginDialog extends ComponentEx<IProps, ILoginDialogState> {
  // private mKeyValidation = /^[a-zA-Z0-9\-]*$/;
  private mKeyValidation = /^[a-zA-Z0-9\-=]*$/;
  private mModalRef = React.createRef<ModalBody>();

  constructor(props: IProps) {
    super(props);   

    this.initState({
      troubleshoot: false,
      apiKeyInput: '',
      requested: false,
      context: undefined,
      showElement: false,
      invalidToken: false,
    });
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if (newProps.visible && !this.props.visible) {
      this.nextState.troubleshoot = false;
      this.nextState.apiKeyInput = '';
    }
    if ((newProps.loginId !== this.props.loginId)
        && (this.props.loginId === undefined)) {
      this.nextState.troubleshoot = false;
      this.nextState.apiKeyInput = '';
    }
    if (newProps.loginError !== this.props.loginError) {
      this.nextState.troubleshoot = true;
    }
  }

  public render(): JSX.Element {
    const { troubleshoot } = this.state;
    const { t, loginId, visible, oauthPending } = this.props;

    return (
      <Modal
        backdrop='static'
        id='login-dialog'
        show={visible || (oauthPending !== undefined)}
        onHide={this.hide}
      >
        <Modal.Body ref={this.mModalRef}>
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
    const { t, loginId, oauthPending, visible } = this.props;
    const { requested, showElement } = this.state;
    
    return (
      <div className='login-content'>
        <Icon
              className='nexus-header'
              name='nexus-header'
              svgStyle='#login-dialog path { fill: black }' />
        {
        (visible && (oauthPending === undefined)) ?
          <div>
            <h2>{t('Log in or register on the Nexus Mods website')}</h2>
            <p>{t('To access this content, please login to the Nexus Mods website.')}</p>
            <p>{t('Click the button below to start the login/registration process.')}</p>
            <Button tooltip={t('Start login')} onClick={this.login}>{t('Login')}</Button>
          </div>
        : loginId !== undefined ? [(
          <LoginInProgress
            key='login-in-progress'
            t={t}
            loginId={loginId}
            onCopyToClipboard={() => this.copyToClipboard(oauthPending)}
          />
        ), (
          <Button
            key='login-press-authorise'
            onClick={nop}
            tooltip={t('Please click "Authorise" on the website')}
            disabled={true}
          >
            <div>
              <Spinner />
              {t('Please click "Authorise" on the website')}
            </div>
          </Button>
        ), (
          <a
            key='troubleshoot-button'
            onClick={this.troubleshoot}
          >
            {t('Not working? Try manual login.')}
          </a>
        ),
        ] : (
        <div>

        <h2>{t('Log in or register on the Nexus Mods website')}</h2>

        <p>{t('Look out for a browser window opening and log in/register if required.')}</p>

        <div className='login-please-click'>
          <Spinner />
          <h4>{t('Please click "authorise" on the website')}</h4>
        </div>

        <h3>{t('Website didn\'t open?')}</h3>

        <p>{t('Copy the following address into your browser window. We support Chrome, Safari, Firefox and Edge.')}</p>

        <CopyClipboardInput inputValue={oauthPending} />

        <p>{t('Still not working?')} <a 
          key='troubleshoot-button'
          onClick={this.troubleshoot}>{t('Log in with token')}
          </a>
        </p>

        </div>

        )}
      </div>
    );
  }

  private renderTroubleshoot() {
    const { apiKeyInput, context, invalidToken } = this.state;
    const { t, oauthPending } = this.props;

    const keyValid = this.mKeyValidation.test(apiKeyInput);

    return (
      <div className='login-content'>
        <Icon
              className='nexus-header'
              name='nexus-header'
              svgStyle='#login-dialog path { fill: black }' />        

        <h2>{t('Log in with token')}</h2>

        <ol style={{ textAlign: 'left' }}>
        <li>
        <p>{t('Copy the following address into your browser and log in/register if required (skip this step if you already have the token). We support Chrome, Safari, Firefox and Edge.')}</p>

        <CopyClipboardInput inputValue={oauthPending} />
                  
        </li>
        <li>
        <p>{t('Click "Authorise" on the website and you will be given a token, copy and paste the token below and click save.')}</p>
     
        <PlaceholderTextArea t={t} mModalRef={this.mModalRef} className='token-paste-textarea' onChange={this.updateAPIKey}/>

        </li>
        </ol>

            <Button
              tooltip={t('Save')}
              onClick={this.applyKey}
              // disabled={!keyValid}
            >
              {t('Save')}
            </Button>

            <div className='login-invalid-key-group' style={{visibility: invalidToken?'visible':'hidden'}}>
            <p className='login-invalid-key-danger'>{t('Your token was not recognised.')}</p>
              <p className='login-invalid-key-details'>{t('Please try again. Copy the token using the button on the website.')}</p>
              </div>
      </div>
    );
  }

  private decodeB64(input: string): string {
    return Buffer.from(input, 'base64').toString();
  }

  private applyKey = async () => {
    try {
      const decoded = JSON.parse(this.decodeB64(this.state.apiKeyInput));
      await this.props.onReceiveCode(decoded.authorization_code, decoded.state);
      this.nextState.invalidToken = false;
      this.props.onHide();
    } catch (err) {
      this.nextState.invalidToken = true;
      this.context.api.showErrorNotification('Invalid token', err, { allowReport: false });
    }
  };

  private onShowContext = (event: React.MouseEvent<any>) => {
    const modalDom = findDOMNode(this.mModalRef.current) as Element;
    const rect: DOMRect = modalDom.getBoundingClientRect() as DOMRect;
    this.nextState.context = { x: event.clientX - rect.x, y: event.clientY - rect.y };
  }

  private onHideContext = () => {
    this.nextState.context = undefined;
  }

  private storeKey(key: string) {
    this.nextState.apiKeyInput = key.replace(/\s/g, '');

  }

  private handlePaste = () => {
    this.storeKey(clipboard.readText());
    this.nextState.context = undefined;
  }

  private renderConfirmDialog() {
    return this.context.api.showDialog('question', 'Login incomplete', {
      text: 'Vortex is not logged in yet, are you sure you wish to abort the login process?',
    }, [
      { label: 'Cancel' },
      { label: 'Abort Login', action: () => {
        this.hide();
      } },
    ]);
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
    this.storeKey(evt.target.value);
  };

  private close = () => {
    const { onResetOauthPending } = this.props;    

    this.nextState.invalidToken = false;

    // wipe the redux state
    onResetOauthPending();

    this.hide();
  }

  private troubleshoot = () => {
    this.nextState.troubleshoot = true;
  }

  private copyToClipboard(text: string) {
    
    try {
      clipboard.writeText(text);

      // show the clipboard message, turn it off again 3 seconds later
      this.nextState.showElement = true; 
      setTimeout(() => this.nextState.showElement = false, 3000)

    } catch (err) {
      // apparently clipboard gets lazy-loaded and that load may fail for some reason
      this.context.api.showErrorNotification('Failed to access clipboard',
                                             err, { allowReport: false });
    }
  }

  private login = () => {
    const { onHide } = this.props;
    this.nextState.requested = true;
    this.context.api.events.emit('request-nexus-login', (err: Error) => {
      this.nextState.requested = false;
      if ((err !== null) && !(err instanceof UserCanceled)) {
        this.context.api.showErrorNotification(
          'Failed to get access key', err, { id: 'failed-get-nexus-key', allowReport: false });
      }
      onHide();
    });
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    userInfo: state.persistent.nexus.userInfo,
    loginId: state.session.nexus.loginId || undefined,
    loginError: state.session.nexus.loginError || undefined,
    oauthPending: state.session.nexus.oauthPending || undefined,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetAPIKey: (APIKey: string) => dispatch(setUserAPIKey(APIKey)),
    onShowLoginError:
    (message: string) => dispatch(showDialog('error', 'Error', { message },
                                             [ { label: 'Close' } ])),
    onResetLoginId: () => dispatch(setLoginId(undefined)),
    onResetOauthPending: () => dispatch(setOauthPending(undefined)),
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(
      LoginDialog)) as React.ComponentClass<IBaseProps>;
