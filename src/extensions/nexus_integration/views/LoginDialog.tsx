import { ComponentEx, translate } from '../../../util/ComponentEx';

import { IValidateKeyData } from '../types/IValidateKeyData';

import LoginForm from './LoginForm';

import * as React from 'react';
import { Modal } from 'react-bootstrap';

export interface IBaseProps {
  shown: boolean;
  APIKey: string;
  nexus: any;
  validateKeyData: IValidateKeyData;
  onHide: () => void;
}

type IProps = IBaseProps;

class LoginDialog extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, APIKey, nexus, shown, onHide, validateKeyData } = this.props;
    return (
      <Modal show={shown} onHide={ onHide }>
        <Modal.Header>
          <Modal.Title>
          { APIKey === '' ? t('API Key Validation') : t('User Info') }
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <LoginForm onClose={ onHide } nexus={ nexus } validateKeyData={validateKeyData} />
        </Modal.Body>
      </Modal>
    );
  }
}

export default
  translate([ 'common' ], { wait: false })(LoginDialog) as React.ComponentClass<IBaseProps>;
