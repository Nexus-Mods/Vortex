import { setDialogVisible } from '../../../actions/session';
import Icon from '../../../controls/Icon';
import { Button } from '../../../controls/TooltipControls';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import opn from '../../../util/opn';
import { truthy } from '../../../util/util';

import { setUserAPIKey } from '../actions/account';
import { IValidateKeyData } from '../types/IValidateKeyData';

import NexusT from '@nexusmods/nexus-api';
import * as React from 'react';
import { Image } from 'react-bootstrap';
import { WithTranslation } from 'react-i18next';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

export interface IBaseProps extends WithTranslation {
  nexus: NexusT;
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

const START_TIME = Date.now();

class LoginIcon extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
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
    const { t, APIKey, userInfo } = this.props;

    if ((APIKey !== undefined) && (userInfo !== undefined) && (userInfo !== null)) {
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
    const { t, APIKey, userInfo } = this.props;

    const loggedIn = (APIKey !== undefined) && (userInfo !== undefined) && (userInfo !== null);

    const profileIcon = truthy(userInfo.profileUrl)
      ? `${userInfo.profileUrl}?r_${START_TIME}`
      : 'assets/images/noavatar.png';

    return (
      <Button
        id='btn-login'
        tooltip={loggedIn ? t('Show Details') : t('Log in')}
        onClick={this.showLoginLayer}
      >
        {loggedIn ? (
          <Image
            src={profileIcon}
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
    const { userInfo } = this.props;
    if ((userInfo === undefined) || (userInfo === null)) {
      this.setDialogVisible(true);
    } else {
      opn(`https://www.nexusmods.com/users/${userInfo.userId}`).catch(err => undefined);
    }
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
    userInfo: state.persistent.nexus.userInfo,
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
