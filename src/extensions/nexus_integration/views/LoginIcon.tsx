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

interface IBaseProps {
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
      <span className='pull-right'>
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
        <FormGroup
          bsSize={'small'}
          className='pull-right'
        >
          <div className='lbl-username'>
            {userInfo.name}
          </div>
          <div className='div-logout'>
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

    if ((APIKey !== undefined) && (userInfo !== undefined)) {
      return (
        <Button
          id='btn-login'
          tooltip={t('Login')}
          onClick={this.showLoginLayer}
          className='pull-right'
        >
          <Image
            src={userInfo.profileUrl}
            circle
            style={{ height: 32, width: 32 }}
          />
        </Button>
      );
    } else {
      return (
        <Button
          id='login-btn'
          tooltip={t('Login')}
          placement='top'
          onClick={this.showLoginLayer}
          className='pull-right'
        >
          <Icon name='user' className='logout-avatar' />
        </Button>
      );
    }
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
    translate(['common'], { wait: false })(LoginIcon),
  );
