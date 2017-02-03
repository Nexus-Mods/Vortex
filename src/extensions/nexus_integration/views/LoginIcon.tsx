import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';
import Icon from '../../../views/Icon';
import { Button } from '../../../views/TooltipControls';

import LoginDialog from './LoginDialog';

import Nexus from 'nexus-api/lib/Nexus';
import * as React from 'react';
import update = require('react-addons-update');

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

    return (
      <span>
        <Button
          className='btn-embed'
          id='login-btn'
          tooltip={t('Login')}
          placement='top'
          onClick={ this.showLoginLayer }
        >
          <Icon name='user' style={{ color: APIKey === undefined ? 'red' : 'green' }} />
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
    APIKey: getSafe(state, ['confidential', 'account', 'nexus', 'APIKey'], undefined),
  };
}

export default
  connect(mapStateToProps)(
    translate(['common'], { wait: false })(LoginIcon)
  );
