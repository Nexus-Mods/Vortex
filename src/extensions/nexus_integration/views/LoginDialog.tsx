import { showDialog } from '../../../actions/notifications';
import Icon from '../../../controls/Icon';
import { Button, IconButton } from '../../../controls/TooltipControls';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';

import { setUserAPIKey } from '../actions/account';
import { IValidateKeyData } from '../types/IValidateKeyData';

import * as React from 'react';
import { Modal } from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

export interface IBaseProps {
  visible: boolean;
  onHide: () => void;
}

interface IConnectedProps {
  APIKey: string;
  userInfo: IValidateKeyData;
}

interface IActionProps {
  onSetAPIKey: (APIKey: string) => void;
  onShowLoginError: (message: string) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

interface IValidationState {
  state?: 'success' | 'warning' | 'error';
  reason?: string;
  pending?: boolean;
}

interface ILoginFormState {
  APIKey: string;
  didSubmit: boolean;
}

class LoginDialog extends ComponentEx<IProps, ILoginFormState> {
  constructor(props: IProps) {
    super(props);

    this.state = {
      APIKey: props.APIKey,
      didSubmit: false,
    };
  }

  public render(): JSX.Element {
    const { t, visible, onHide } = this.props;
    return (
      <Modal id='login-dialog' show={visible} onHide={onHide}>
        <Modal.Body>
          <IconButton
            className='close-button'
            id='btn-close-login'
            onClick={onHide}
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
            <Button
              onClick={this.login}
              tooltip={t('Opens the Nexus Mods page in your default browser')}
            >
              {t('Log In On Website')}
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    );
  }

  private login = () => {
    const { onHide } = this.props;
    this.context.api.events.emit('request-nexus-login', (err: Error) => {
      if (err !== null) {
        this.context.api.showErrorNotification('Failed to get access key', err);
      }
      onHide();
    });
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    APIKey: state.confidential.account.nexus.APIKey,
    userInfo: state.persistent.nexus.userInfo,
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
