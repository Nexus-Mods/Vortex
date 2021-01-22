import { setDialogVisible } from '../../../actions/session';
import Icon from '../../../controls/Icon';
import Image from '../../../controls/Image';
import * as tooltip from '../../../controls/TooltipControls';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import opn from '../../../util/opn';
import { truthy } from '../../../util/util';

import { setUserAPIKey } from '../actions/account';
import { IValidateKeyData } from '../types/IValidateKeyData';

import { FALLBACK_AVATAR } from '../constants';

import NexusT from '@nexusmods/nexus-api';
import * as React from 'react';
import { WithTranslation } from 'react-i18next';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { pathToFileURL } from 'url';

export interface IBaseProps extends WithTranslation {
  nexus: NexusT;
}

interface IConnectedProps {
  APIKey: string;
  userInfo: IValidateKeyData;
  networkConnected: boolean;
}

interface IActionProps {
  onSetAPIKey: (APIKey: string) => void;
  onShowDialog: () => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

const START_TIME = Date.now();

class LoginIcon extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, networkConnected } = this.props;
    if (!networkConnected) {
      return (
        <span id='login-control'>
          <tooltip.Icon name='disconnected' tooltip={t('Network is offline')} />
        </span>
      );
    }
    return (
      <span id='login-control'>
        {this.renderLoginName()}
        {this.renderAvatar()}
      </span >
    );
  }

  private logOut = () => {
    const { onSetAPIKey } = this.props;
    onSetAPIKey(undefined);
  }

  private renderLoginName() {
    const { t, userInfo } = this.props;

    if (this.isLoggedIn()) {
      return (
        <div>
          <div className='username'>
            {userInfo.name}
          </div>
          <div className='logout-button'>
            <a onClick={this.logOut}>{t('Log out')}</a>
          </div>
        </div>
      );
    } else {
      return null;
    }
  }

  private renderAvatar() {
    const { t, userInfo } = this.props;

    const loggedIn = this.isLoggedIn();

    const profileIcon = truthy(userInfo) && truthy(userInfo.profileUrl)
      ? `${pathToFileURL(userInfo.profileUrl).href}?r_${START_TIME}`
      : pathToFileURL(FALLBACK_AVATAR).href;

    return (
      <tooltip.Button
        id='btn-login'
        tooltip={loggedIn ? t('Show Details') : t('Log in')}
        onClick={this.showLoginLayer}
      >
        {loggedIn ? (
          <Image
            srcs={[profileIcon, FALLBACK_AVATAR]}
            circle
            style={{ height: 32, width: 32 }}
          />
        ) : (
            <Icon name='user' className='logout-avatar' />
          )
        }
      </tooltip.Button>
    );
  }

  private showLoginLayer = () => {
    const { userInfo } = this.props;
    if (!this.isLoggedIn()) {
      this.setDialogVisible(true);
    } else {
      opn(`https://www.nexusmods.com/users/${userInfo.userId}`).catch(err => undefined);
    }
  }

  private isLoggedIn() {
    const { APIKey, userInfo } = this.props;
    return (APIKey !== undefined) && (userInfo !== undefined) && (userInfo !== null);
  }

  private hideLoginLayer = () => {
    this.setDialogVisible(false);
  }

  private setDialogVisible(visible: boolean): void {
    this.props.onShowDialog();
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    APIKey: (state.confidential.account as any).nexus.APIKey,
    userInfo: (state.persistent as any).nexus.userInfo,
    networkConnected: state.session.base.networkConnected,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetAPIKey: (APIKey: string) => dispatch(setUserAPIKey(APIKey)),
    onShowDialog: () => dispatch(setDialogVisible('login-dialog')),
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(
      LoginIcon)) as React.ComponentClass<IBaseProps>;
