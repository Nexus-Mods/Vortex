import { IsValidNewOptionHandler } from 'react-select';
import { showDialog } from '../../../actions/notifications';
import ContextMenu from '../../../controls/ContextMenu';
import FormFeedback from '../../../controls/FormFeedback';
import Icon from '../../../controls/Icon';
import Modal from '../../../controls/Modal';
import Spinner from '../../../controls/Spinner';
import CopyClipboardInput from '../../../controls/CopyClipboardInput';
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
import { dispatch } from 'd3-dispatch';
import { useEffect } from 'react';

const API_ACCESS_URL = `${NEXUS_BASE_URL}/users/myaccount?tab=api+access`;



export interface IBaseProps extends WithTranslation {
  visible: boolean;
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
}

class LoginDialog extends ComponentEx<IProps, ILoginDialogState> {
  private mKeyValidation = /^[a-zA-Z0-9\-]*$/;
  private mModalRef = React.createRef<ModalBody>();

  constructor(props: IProps) {
    super(props);   

    this.initState({
      troubleshoot: false,
      apiKeyInput: '',
      requested: false,
      context: undefined,
      showElement: false
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
        show={(oauthPending !== undefined)}
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
    const { t, loginId, oauthPending } = this.props;
    const { requested, showElement } = this.state;
    
    return (
      <div className='login-content'>
        <Icon
              className='nexus-header'
              name='nexus-header'
              svgStyle='#login-dialog path { fill: black }' />
        {
        loginId !== undefined ? [(
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
    const { apiKeyInput, context, showElement } = this.state;
    const { t, loginError, oauthPending } = this.props;

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
        <FormGroup controlId='' validationState={keyValid ? null : 'error'}>
              <FormControl
                componentClass='textarea'
                style={{display: 'inline', verticalAlign: 'top', height: '6em', resize: 'none'}}
                placeholder={t('Paste that api key into this input field')}
                value={apiKeyInput}
                onChange={this.updateAPIKey}
                onContextMenu={this.onShowContext}
                draggable={false}
              />
              <ContextMenu
                instanceId='login-context'
                visible={context !== undefined}
                position={context}
                onHide={this.onHideContext}
                actions={[
                  { title: t('Paste'), action: this.handlePaste, show: true },
                ]}
              />
              <FormFeedback />
              {keyValid ? null : <ControlLabel>{t('Invalid key')}</ControlLabel>}
            </FormGroup>

        </li>
        </ol>

        
            <Button
              tooltip={t('Save')}
              // disabled={!keyValid}
            >
              {t('Save')}
            </Button>
          
      </div>
    );
  }

  private onShowContext = (event: React.MouseEvent<any>) => {
    const modalDom = findDOMNode(this.mModalRef.current) as Element;
    const rect: DOMRect = modalDom.getBoundingClientRect() as DOMRect;
    this.nextState.context = { x: event.clientX - rect.x, y: event.clientY - rect.y };
  }

  private onHideContext = () => {
    this.nextState.context = undefined;
  }

  private handlePaste = () => {
    this.nextState.apiKeyInput = clipboard.readText();
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

    const { onResetOauthPending } = this.props;
    
    console.log('close button pressed');

    // wipe the redux state
    onResetOauthPending();

    this.hide();
    
    /*
    // if we are mid login, then request confirmation before we close
    if (oauthPending !== undefined) {
      
      // request confirmation before we close
      this.renderConfirmDialog().catch(err => {
        log('error', 'failed to show dialog', err.message);
      });
    }*/
      
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
