import { IconButton } from '../../../controls/TooltipControls';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { setUserAPIKey } from '../actions/account';
import { IValidateKeyData } from '../types/IValidateKeyData';

import opn = require('opn');
import * as React from 'react';
import { Button, Image } from 'react-bootstrap';
import * as Redux from 'redux';
import { setDialogVisible } from '../../../actions/session';

interface IConnectedProps {
  userInfo: IValidateKeyData;
}

interface IActionProps {
  onSetAPIKey: (APIKey: string) => void;
  onSetDialogVisible: (id: string) => void;
}

type IProps = IConnectedProps & IActionProps;

class DashboardBanner extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { userInfo } = this.props;
    if ((userInfo !== undefined) && (userInfo !== null)) {
      return this.renderLoggedIn(userInfo);
    } else {
      return this.renderRegister();
    }
  }

  private renderRegister(): JSX.Element {
    const { t } = this.props;
    return (
      <div className='dashlet-nexus-login'>
        <div className='nexus-login-heading'>{t('Register or Log In')}</div>
        <div className='nexus-login-text'>
          {t('Log in using your Nexus Mods account or register a new account '
            + 'on the Nexus Mods website to get the best experience!')}
        </div>
        <Button onClick={this.login}>
          {t('Log In or Register')}
        </Button>
      </div>
    );
  }

  private renderLoggedIn(userInfo: IValidateKeyData): JSX.Element {
    const { t } = this.props;
    return (
      <div className='dashlet-nexus-account'>
        <Image
          src={userInfo.profileUrl  || 'assets/images/noavatar.png'}
          circle
          style={{ height: 64, width: 64, marginRight: 32 }}
        />
        <div className='nexus-name'>
          <div className='nexus-name-username'>
            {userInfo.name}
          </div>
          <div className='nexus-name-account'>
            {
              userInfo.isPremium
                ? t('Premium')
                : userInfo.isSupporter
                  ? t('Supporter')
                  : t('Member')
            }
            {' \u00B7 '}
            <a onClick={this.openProfile}>{t('See Profile')}</a>
          </div>
        </div>
        <div>
          <IconButton icon='logout' onClick={this.logout} tooltip={t('Logout')} />
        </div>
      </div>
    );
  }

  private login = () => {
    this.context.api.events.emit('request-nexus-login', (err: Error) => {
      if (err !== null) {
        this.context.api.showErrorNotification('Failed to get access key', err);
      }
    });
    // this.props.onSetDialogVisible('login-dialog');
  }

  private openProfile = () => {
    const { userInfo } = this.props;
    opn(`https://www.nexusmods.com/users/${userInfo.userId}`).catch(err => undefined);
  }

  private logout = () => {
    const { onSetAPIKey } = this.props;
    onSetAPIKey(undefined);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    userInfo: state.session.nexus.userInfo,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetAPIKey: (APIKey: string) => dispatch(setUserAPIKey(APIKey)),
    onSetDialogVisible: (id: string) => dispatch(setDialogVisible(id)),
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(
    translate(['common'], { wait: false })(
      DashboardBanner)) as React.ComponentClass<{}>;
