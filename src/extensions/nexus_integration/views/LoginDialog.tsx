import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { getSafe } from '../../../util/storeHelper';

import { setUserAPIKey } from '../actions/account';
import { IValidateKeyData } from '../types/IValidateKeyData';

import LoginForm from './LoginForm';

import * as React from 'react';
import { Modal } from 'react-bootstrap';

export interface IBaseProps {
  visible: boolean;
  onHide: () => void;
}

interface IConnectedProps {
  APIKey: string;
  userInfo: IValidateKeyData;
}

type IProps = IBaseProps & IConnectedProps;

class LoginDialog extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, APIKey, visible, onHide, userInfo } = this.props;
    return (
      <Modal show={visible} onHide={ onHide }>
        <Modal.Header>
          <Modal.Title>
          { APIKey === '' ? t('API Key Validation') : t('User Info') }
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <LoginForm onClose={ onHide } userInfo={userInfo} />
        </Modal.Body>
      </Modal>
    );
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    APIKey: state.confidential.account.nexus.APIKey,
    userInfo: state.session.nexus.userInfo,
  };
}

export default
  connect(mapStateToProps)(
    translate(['common'], { wait: false })(
      LoginDialog)) as React.ComponentClass<IBaseProps>;
