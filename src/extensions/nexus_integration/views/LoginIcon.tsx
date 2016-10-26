import Nexus from '../../../../lib/js/nexus-api/lib/Nexus';

import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import Icon from '../../../views/Icon';
import { Button } from '../../../views/TooltipControls';

import LoginDialog from './LoginDialog';

import * as React from 'react';
import update = require('react-addons-update');

import { log } from '../../../util/log';

interface IBaseProps {
  nexus: Nexus;
}

interface IConnectedProps {
  APIKey: string;
}

interface IComponentState {
  dialogVisible: boolean;
}

type IProps = IBaseProps & IConnectedProps;

class LoginIcon extends ComponentEx<IProps, IComponentState> {
  constructor(props) {
    super(props);
    this.state = {
      dialogVisible: false,
    };
  }

  public render(): JSX.Element {
    const { t, APIKey, nexus } = this.props;
    const { dialogVisible } = this.state;

    log('info', 'nexus', { nexus });

    return (
      <span>
        <Button
          className='btn-embed'
          id='login-btn'
          tooltip={t('Login')}
          placement='top'
          onClick={ this.showLoginLayer }
        >
          <Icon name='user' style={{ color: APIKey === '' ? 'red' : 'green' }} />
        </Button>
        <LoginDialog
          APIKey={ APIKey }
          shown={ dialogVisible }
          onHide={ this.hideLoginLayer }
          nexus={ nexus }
        />
      </span>
    );
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
    APIKey: state.account.nexus.APIKey,
  };
}

export default
  connect(mapStateToProps)(
    translate(['common'], { wait: true })(LoginIcon)
  );
