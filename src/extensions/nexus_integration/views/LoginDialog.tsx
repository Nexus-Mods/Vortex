import { showDialog } from '../../../actions/notifications';
import Icon from '../../../controls/Icon';
import Spinner from '../../../controls/Spinner';
import { Button, IconButton } from '../../../controls/TooltipControls';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { UserCanceled } from '../../../util/CustomErrors';

import { setUserAPIKey } from '../actions/account';
import { IValidateKeyData } from '../types/IValidateKeyData';

import { clipboard } from 'electron';
import * as React from 'react';
import { Modal, FormControl, ControlLabel, FormGroup, InputGroup, InputGroupAddon } from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

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
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class LoginDialog extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, loginId, visible } = this.props;
    return (
      <Modal id='login-dialog' show={visible || (loginId !== undefined)} onHide={this.hide}>
        <Modal.Body>
          <IconButton
            className='close-button'
            id='btn-close-login'
            onClick={this.hide}
            tooltip={t('Close')}
            icon='close'
          />
          <div className='login-content'>
            <Icon
              className='nexus-header'
              name='nexus-header'
              svgStyle='#login-dialog path { fill: black }'
            />
            <div className='login-instructions'>
              {t('Please log in or register on the Nexus Mods website to log in on vortex!')}
            </div>
            {loginId !== undefined ? (
              <form>
                <FormGroup>
                  <ControlLabel>
                  {t('Vortex should have opened the following url in your default browser. If that failed, please copy the url '
                    + 'into your browser manually.')}
                  </ControlLabel>
                  <InputGroup>
                    <FormControl
                      type="text"
                      value={this.getLoginUrl()}
                      disabled={true}
                    />
                    <InputGroup.Addon>
                      <IconButton className='btn-embed' icon='clipboard' tooltip={t('Copy to clipboard')} onClick={this.copyUrlToClipboard} />
                    </InputGroup.Addon>
                  </InputGroup>
                </FormGroup>
              </form>
            ) : null}
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
        </Modal.Body>
      </Modal>
    );
  }

  private hide = () => {
    const { onCancelLogin, onHide } = this.props;
    onCancelLogin();
    onHide();
  }

  private login = () => {
    const { onHide } = this.props;
    this.context.api.events.emit('request-nexus-login', (err: Error) => {
      if ((err !== null) && !(err instanceof UserCanceled)) {
        this.context.api.showErrorNotification('Failed to get access key', err, { allowReport: false });
      }
      onHide();
    });
  }

  private getLoginUrl() {
    const { loginId } = this.props;
    return `https://www.nexusmods.com/sso?id=${loginId}`;
  }

  private copyUrlToClipboard = () => {
    clipboard.writeText(this.getLoginUrl());
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
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(
    translate(['common'], { wait: false })(
      LoginDialog)) as React.ComponentClass<IBaseProps>;
