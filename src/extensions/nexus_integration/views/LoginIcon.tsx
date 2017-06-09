import { setDialogVisible } from '../../../actions/session';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';
import Icon from '../../../views/Icon';
import { Button, IconButton } from '../../../views/TooltipControls';

import { setUserAPIKey } from '../actions/account';
import { IValidateKeyData } from '../types/IValidateKeyData';

import LoginDialog from './LoginDialog';

import * as update from 'immutability-helper';
import Nexus from 'nexus-api';
import * as React from 'react';
import { ControlLabel, Form, FormGroup, Image } from 'react-bootstrap';

export interface IBaseProps {
  nexus: Nexus;
}

interface IConnectedProps {
  APIKey: string;
  userInfo: IValidateKeyData;
}

interface IActionProps {
  onSetAPIKey: (APIKey: string) => void;
  onShowDialog: () => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class LoginIcon extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    return (
      <span id='login-control'>
        {this.renderAvatar()}
        {this.renderLoginName()}
      </span >
    );
  }

  private logOut = () => {
    const { onSetAPIKey } = this.props;
    onSetAPIKey(undefined);
  }

  private renderLoginName() {
    const { t, APIKey, userInfo } = this.props;

    if ((APIKey !== undefined) && (userInfo !== undefined)) {
      return (
        <FormGroup style={{ float: 'left' }}>
          <div className='username'>
            {userInfo.name}
          </div>
          <div className='logout-button'>
            <a onClick={this.logOut}>{t('Log out')}</a>
          </div>
        </FormGroup>
      );
    } else {
      return null;
    }
  }

  private renderAvatar() {
    const { t, APIKey, userInfo } = this.props;

    const loggedIn = (APIKey !== undefined) && (userInfo !== undefined);

    return (
      <Button
        id='btn-login'
        tooltip={loggedIn ? t('Show Details') : t('Log in')}
        onClick={this.showLoginLayer}
        className='pull-right'
      >
        {loggedIn ? (
          <Image
            src={userInfo.profileUrl}
            circle
            style={{ height: 32, width: 32 }}
          />
        ) : (
            <Icon name='user' className='logout-avatar' />
          )
        }
      </Button>
    );
  }

  private showLoginLayer = () => {
    this.setDialogVisible(true);
  }

  private hideLoginLayer = () => {
    this.setDialogVisible(false);
  }

  private setDialogVisible(visible: boolean): void {
    this.props.onShowDialog();
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    APIKey: state.confidential.account.nexus.APIKey,
    userInfo: state.session.nexus.userInfo,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetAPIKey: (APIKey: string) => dispatch(setUserAPIKey(APIKey)),
    onShowDialog: () => dispatch(setDialogVisible('login-dialog')),
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(
    translate(['common'], { wait: false })(
      LoginIcon)) as React.ComponentClass<IBaseProps>;
