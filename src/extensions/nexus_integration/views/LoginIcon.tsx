import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';
import Icon from '../../../views/Icon';
import { Button, IconButton } from '../../../views/TooltipControls';

import { setUserAPIKey } from '../actions/account';
import { IValidateKeyData } from '../types/IValidateKeyData';

import LoginDialog from './LoginDialog';

import Nexus, { IValidateKeyResponse } from 'nexus-api';
import * as React from 'react';
import { ControlLabel, Form, FormGroup, Image } from 'react-bootstrap';
import update = require('react-addons-update');

interface IBaseProps {
  nexus: Nexus;
}

interface IConnectedProps {
  APIKey: string;
}

interface IActionProps {
  onSetAPIKey: (APIKey: string) => void;
}

interface IComponentState {
  dialogVisible: boolean;
  APIKey: string;
  validateKeyData: IValidateKeyData;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class LoginIcon extends ComponentEx<IProps, IComponentState> {
  constructor(props) {
    super(props);
    this.state = {
      dialogVisible: false,
      APIKey: '',
      validateKeyData: {
        userId: 0,
        name: '',
        isPremium: false,
        isSupporter: false,
        email: '',
        profileUrl: '',
      },
    };
  }

  public componentWillMount() {
    if (this.props.APIKey !== undefined) {
      this.loadUserInfo(this.props.APIKey);
    }
  }

  public componentWillReceiveProps(newProps: IProps) {

    if ((this.props.APIKey !== newProps.APIKey)) {
      if (newProps.APIKey !== undefined) {
        this.loadUserInfo(newProps.APIKey);
      } else {
        const keyData: IValidateKeyData = {
          userId: 0,
          name: '',
          isPremium: false,
          isSupporter: false,
          email: '',
          profileUrl: '',
        };

        this.setState(update(this.state, {
          validateKeyData: { $set: keyData },
        }));
      }
    }
  }

  public render(): JSX.Element {
    const { t, APIKey, nexus } = this.props;
    const { dialogVisible, validateKeyData } = this.state;

    return (
      <span>
        {this.renderAvatar()}
        {this.renderLoginName()}
        <LoginDialog
          APIKey={APIKey}
          shown={dialogVisible}
          onHide={this.hideLoginLayer}
          nexus={nexus}
          validateKeyData={validateKeyData}
        />
      </span >
    );
  }

  private logOut = () => {
    const { onSetAPIKey } = this.props;
    onSetAPIKey(undefined);
  }

  private renderLoginName() {
    const { validateKeyData } = this.state;
    const { t } = this.props;

    if (validateKeyData.name !== '') {
      return (
        <FormGroup bsSize={'small'} className='pull-right'>
          <div>
            <ControlLabel>{validateKeyData.name}</ControlLabel>
          </div>
          <div>
            <a style={{ color: 'red' }} onClick={this.logOut}>{t('Log out')}</a>
          </div>
        </FormGroup>
      );
    } else {
      return null;
    }
  }

  private renderAvatar() {
    const { t } = this.props;
    const { validateKeyData } = this.state;

    if (validateKeyData.name !== '') {
      return (
        <Button
          id='btn-login'
          tooltip={t('Login')}
          onClick={this.showLoginLayer}
          className='pull-right'
        >
          <Image
            src={validateKeyData.profileUrl}
            circle
            style={{height: 32, width: 32}}
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
          <Icon name='user' style={{ color: 'red' }} />
        </Button>
      );
    }
  }

  private loadUserInfo(APIKey: string) {
    const { nexus } = this.props;
    const { validateKeyData } = this.state;

    nexus.validateKey(APIKey)
      .then((data: IValidateKeyResponse) => {

        const keyData: IValidateKeyData = {
          email: data.email,
          isPremium: data['is_premium?'],
          isSupporter: data['is_supporter?'],
          name: data.name,
          profileUrl: data.profile_url,
          userId: data.user_id,
        };

        this.setState(update(this.state, {
          validateKeyData: { $set: keyData },
        }));
      });
  }

  private showLoginLayer = () => {
    this.setDialogVisible(true);
  }

  private hideLoginLayer = () => {
    this.setDialogVisible(false);
  }

  private setDialogVisible(visible: boolean): void {
    this.setState(update(this.state, {
      dialogVisible: { $set: visible },
    }));
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    APIKey: getSafe(state, ['confidential', 'account', 'nexus', 'APIKey'], undefined),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetAPIKey: (APIKey: string) => dispatch(setUserAPIKey(APIKey)),
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(
    translate(['common'], { wait: false })(LoginIcon),
  );
