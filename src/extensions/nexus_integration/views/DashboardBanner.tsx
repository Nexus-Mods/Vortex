import { setDialogVisible } from '../../../actions/session';
import Image from '../../../controls/Image';
import Spinner from '../../../controls/Spinner';
import { IconButton } from '../../../controls/TooltipControls';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { UserCanceled } from '../../../util/CustomErrors';
import getVortexPath from '../../../util/getVortexPath';
import opn from '../../../util/opn';
import { truthy } from '../../../util/util';
import { clearOAuthCredentials, setUserAPIKey } from '../actions/account';
import { IValidateKeyData } from '../types/IValidateKeyData';

import { FALLBACK_AVATAR, NEXUS_BASE_URL } from '../constants';

import * as path from 'path';
import * as React from 'react';
import { Button } from 'react-bootstrap';
import { WithTranslation } from 'react-i18next';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { pathToFileURL } from 'url';

interface IConnectedProps {
  userInfo: IValidateKeyData;
  loginId: string;
}

interface IActionProps {
  onSetAPIKey: (APIKey?: string) => void;
  onClearOAuthCredentials: () => void;
  onSetDialogVisible: (id: string) => void;
}

type IProps = WithTranslation & IConnectedProps & IActionProps;

const START_TIME = Date.now();
class DashboardBanner extends ComponentEx<IProps, { requested: boolean }> {
  constructor(props: IProps) {
    super(props);
    this.initState({
      requested: false,
    });
  }

  public render(): JSX.Element {
    const { userInfo } = this.props;
    if ((userInfo !== undefined) && (userInfo !== null)) {
      return this.renderLoggedIn(userInfo);
    } else {
      return this.renderRegister();
    }
  }

  private renderRegister(): JSX.Element {
    const { t, loginId } = this.props;
    const { requested } = this.state;
    return (
      <div className='dashlet-nexus-login'>
        <div className='nexus-login-heading'>{t('Register or Log In')}</div>
        <div className='nexus-login-text'>
          {t('Log In using your Nexus Mods account or register a new account '
            + 'on the Nexus Mods website to get the best experience!')}
        </div>
        <Button onClick={this.login} disabled={requested || (loginId !== undefined)}>
          {(requested || (loginId !== undefined)) ? <Spinner /> : t('Log In or Register')}
        </Button>
      </div>
    );
  }

  private renderLoggedIn(userInfo: IValidateKeyData): JSX.Element {
    const { t } = this.props;

    const fallback =
      pathToFileURL(path.join(getVortexPath('assets'), '..', FALLBACK_AVATAR)).href;

    const profileIcon = truthy(userInfo) && truthy(userInfo.profileUrl)
      ? `${userInfo.profileUrl}?r_${START_TIME}`
      : fallback;

    return (
      <div className='dashlet dashlet-nexus-account'>
        <Image
          srcs={[profileIcon || fallback, fallback]}
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
    this.nextState.requested = true;
    this.context.api.events.emit('request-nexus-login', (err: Error) => {
      this.nextState.requested = false;
      if ((err !== null) && !(err instanceof UserCanceled)) {
        this.context.api.showErrorNotification('Failed to get access key', err, {
          id: 'failed-get-nexus-key',
          allowReport: false,
        });
      }
    });
    // this.props.onSetDialogVisible('login-dialog');
  }

  private openProfile = () => {
    const { userInfo } = this.props;
    opn(`${NEXUS_BASE_URL}/users/${userInfo.userId}`).catch(err => undefined);
  }

  private logout = () => {
    const { onClearOAuthCredentials, onSetAPIKey } = this.props;
    onSetAPIKey(undefined);
    onClearOAuthCredentials();
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    userInfo: state.persistent.nexus.userInfo,
    loginId: state.session.nexus.loginId,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetAPIKey: (APIKey?: string) => dispatch(setUserAPIKey(APIKey)),
    onClearOAuthCredentials: () => dispatch(clearOAuthCredentials(null)),
    onSetDialogVisible: (id: string) => dispatch(setDialogVisible(id)),
  };
}

export default
connect(mapStateToProps, mapDispatchToProps)(
  translate(['common'])(
    DashboardBanner));
