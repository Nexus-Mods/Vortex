import { setDialogVisible } from '../../../actions/session';
import Icon from '../../../controls/Icon';
import Image from '../../../controls/Image';
import * as tooltip from '../../../controls/TooltipControls';
import { IState } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import getVortexPath from '../../../util/getVortexPath';
import opn from '../../../util/opn';
import { truthy } from '../../../util/util';

import { clearOAuthCredentials, setUserAPIKey } from '../actions/account';
import { IValidateKeyData, IValidateKeyDataV2 } from '../types/IValidateKeyData';

import { FALLBACK_AVATAR, NEXUS_BASE_URL, OAUTH_URL } from '../constants';

import NexusT from '@nexusmods/nexus-api';
import * as path from 'path';
import * as React from 'react';
import { WithTranslation } from 'react-i18next';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { pathToFileURL } from 'url';
import { isLoggedIn } from '../selectors';

import { setOauthPending } from '../actions/session';
import { showError } from '../../../util/message';

export interface IBaseProps extends WithTranslation {
  nexus: NexusT;
}



interface IConnectedProps {
  isLoggedIn: boolean;
  userInfo: IValidateKeyDataV2;
  networkConnected: boolean;
}

interface IActionProps {
  onSetAPIKey: (APIKey: string) => void;
  onClearOAuthCredentials: () => void;
  onShowDialog: () => void;
  onShowError: (title: string, err: Error) => void;
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
        {this.renderMembershipStatus()}
        {this.renderLoginName()}
        {this.renderAvatar()}
      </span >
    );
  }

  private logOut = () => {
    const { onClearOAuthCredentials, onSetAPIKey } = this.props;
    onSetAPIKey(undefined);
    onClearOAuthCredentials();
  }

  private getMembershipText(userInfo: IValidateKeyDataV2):string {

    if(userInfo?.isPremium === true) {
      return '★ Premium';
    }
    else if(userInfo?.isSupporter === true && userInfo?.isPremium === false) {
      return 'Supporter';
    }
    else if(userInfo?.isLifetime === true) {
      return 'Premium';
    }
    return 'Free';
  }

  private renderMembershipStatus = () => {
    const { t, userInfo } = this.props;

    const membership = this.getMembershipText(userInfo);
    const classes = `membership-status ${membership.toLocaleLowerCase()}`

    if (this.isLoggedIn()) {
      return (
        <div id='membership-status' className={classes}>
          <div className='membership-status-text'>{membership}</div>
        </div>
      );
    } else {
      return null;
    }
  }

  private renderLoginName = () => {
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

  private renderAvatar = () => {
    const { t, userInfo } = this.props;

    const loggedIn = this.isLoggedIn();

    const fallback =
      pathToFileURL(path.join(getVortexPath('assets'), '..', FALLBACK_AVATAR)).href;

    const profileIcon = truthy(userInfo?.profileUrl)
      ? `${userInfo.profileUrl}?r_${START_TIME}`
      : fallback;

    return (
      <tooltip.Button
        id='btn-login'
        tooltip={loggedIn ? t('Show Details') : t('Log in')}
        onClick={this.showLoginLayer}
      >
        {loggedIn ? (
          <Image
            srcs={[profileIcon, fallback]}
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

  private showLoginLayer = async () => {
    const { userInfo } = this.props;
    
    if (!this.isLoggedIn()) {
      this.context.api.events.emit('analytics-track-click-event', 'Profile', 'Site profile');
      this.setDialogVisible(true);
      this.launchNexusOauth();
    } else {
      opn(`${NEXUS_BASE_URL}/users/${userInfo.userId}`).catch(err => undefined);
    }
  }

  private launchNexusOauth = () => {
    this.context.api.events.emit('request-nexus-login', (err: Error) => { 
      if (err !== null) {
        this.props.onShowError('Login Failed', err);
        this.hideLoginLayer();
      }
    });
  }

  private isLoggedIn = () => {
    const { isLoggedIn, userInfo } = this.props;
    //return isLoggedIn;
    return isLoggedIn && (userInfo !== undefined) && (userInfo !== null);
  }

  private hideLoginLayer = () => {
    this.setDialogVisible(false);
  }

  private setDialogVisible = (visible: boolean): void => {
    this.props.onShowDialog();
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    isLoggedIn: isLoggedIn(state),
    userInfo: (state.persistent as any).nexus.userInfo,
    networkConnected: state.session.base.networkConnected,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetAPIKey: (APIKey: string) => dispatch(setUserAPIKey(APIKey)),
    onClearOAuthCredentials: () => dispatch(clearOAuthCredentials(null)),
    onShowDialog: () => dispatch(setDialogVisible('login-dialog')),
    onShowError: (title: string, err: Error) =>
      showError(dispatch, title, err, { allowReport: false }),
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(
      LoginIcon)) as React.ComponentClass<IBaseProps>;
