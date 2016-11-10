import Nexus, { IValidateKeyResponse } from 'nexus-api';

import { showDialog } from '../../../actions/notifications';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import FormFeedbackAwesome from '../../../views/FormFeedbackAwesome';
import { Button } from '../../../views/TooltipControls';

import { setUserAPIKey } from '../actions/account';
import { IAccount } from '../types/IAccount';

import * as React from 'react';
import { ControlLabel, FormControl, FormGroup, Image } from 'react-bootstrap';
import update = require('react-addons-update');

export interface IProps {
  onClose: () => void;
  nexus: Nexus;
}

interface ILoginFormState {
  APIKey: string;
  isSubmitted: boolean;
  userId: string;
  name: string;
  isPremium: string;
  email: string;
  statusCode: string;
  statusCodeMessage: string;
  isSupporter: string;
}

interface IConnectedProps {
  account: IAccount;
}

interface IActionProps {
  onSetAPIKey: (APIKey: string) => void;
  onShowLoginError: (message: string) => void;
}

interface IValidationState {
  state?: 'success' | 'warning' | 'pending';
  reason?: string;
}

type ILoginFormProps = IProps & IConnectedProps & IActionProps;

class LoginForm extends ComponentEx<ILoginFormProps, ILoginFormState> {
  constructor(props) {
    super(props);
    this.state = {
      APIKey: '',
      isSubmitted: false,
      userId: '',
      name: '',
      email: '',
      statusCode: null,
      statusCodeMessage: '',
      isPremium: '',
      isSupporter: '',
    };
  }

  public componentWillMount() {
    if (this.props.account.APIKey !== '') {
      this.loadUserInfo();
    }
  }

  public render(): JSX.Element {
    const { t } = this.props;
    const { APIKey, userId } = this.state;
    const { name, email, isPremium, isSupporter } = this.state;

    const propAPIKey = this.props.account.APIKey;

    const validation: IValidationState = this.validationState();

    return (
      <form onSubmit={ this.apiKeySubmit } >
        <FormGroup
            controlId='formUserInfo'
            hidden={ (propAPIKey === '') }
        >
          <div>
            <Image src='./images/avatar.png' width='90' height='90' rounded />
          </div>
          <div>
            <ControlLabel>{'User ID: ' + userId}</ControlLabel>
          </div>
          <div>
            <ControlLabel>{'UserName: ' + name}</ControlLabel>
          </div>
          <div>
            <ControlLabel>{'Premium: ' + (isPremium !== 'false' ? 'YES' : 'NO') }</ControlLabel>
          </div>
          <div>
            <ControlLabel>{'Supporter: ' + (isSupporter !== 'false' ? 'YES' : 'NO') }</ControlLabel>
          </div>
          <div>
            <ControlLabel>{'Email: ' + email}</ControlLabel>
          </div>
        </FormGroup>
        <FormGroup
          controlId='formAPIKeyValidation'
          validationState={validation.state as 'error' | 'success' | 'warning' }
          hidden={ propAPIKey !== '' }
        >
          <ControlLabel>{ validation.reason }</ControlLabel>
          <FormControl
            type='text'
            name='APIKey'
            value={APIKey}
            placeholder={ t('User APIKey') }
            onChange={ this.handleChangeAPIKey }
          />
          <FormFeedbackAwesome />
        </FormGroup>
        { this.renderSubmitButton(t, propAPIKey) }
      </form>
    );
  };

  private renderSubmitButton(t, propAPIKey: string): JSX.Element {
    return (propAPIKey === '')
      ? <Button id='submit-apikey' type='submit' tooltip={ t('Submit') }>
          { t('Submit') }
        </Button>
      : <Button id='remove-apikey' type='submit' tooltip={ t('Remove Key') }>
          { t('Remove Key') }
        </Button>;
  }

  private handleChange(event, field) {
    this.setState(update(this.state, { [field]: { $set: event.target.value } }));
  }

  private validationState(): IValidationState {
    const { isSubmitted, APIKey, statusCode, statusCodeMessage } = this.state;

    if (!isSubmitted) {
      return {};
    }
    if (APIKey.length === 0) {
      return { state: 'warning', reason: 'Missing API Key' };
    }
    if (statusCode === null) {
      return { state: 'pending' };
    }
    if (statusCode !== '200') {
      return { state: 'warning', reason: statusCodeMessage };
    }

    return { state: 'success' };
  }

  private apiKeySubmit = (event) => {
    event.preventDefault();
    this.authenticateAPIKey();
  }

  private authenticateAPIKey() {
    const { nexus, onClose, onSetAPIKey } = this.props;
    const { APIKey } = this.state;
    const propAPIKey = this.props.account.APIKey;

    if (propAPIKey !== '') {
      onSetAPIKey('');
      this.setState(update(this.state, { isSubmitted: { $set: false } }));
      onClose();
    } else {
      this.setState(update(this.state, {
        isSubmitted: { $set: true },
        statusCode: { $set: null },
        statusCodeMessage: { $set: '' },
      }));

      nexus.validateKey(APIKey)
      .then(() => {
        onSetAPIKey(APIKey);
        onClose();
      })
      .catch((err) => {
        this.setState(update(this.state, {
          statusCode: { $set: err.statusCode },
          statusCodeMessage: { $set: err.message },
        }));
      });
    }
  }

  private loadUserInfo() {
    const { nexus } = this.props;
    const { APIKey } = this.state;
    const propAPIKey = this.props.account.APIKey;

    this.setState(update(this.state, { isSubmitted: { $set: true } }));

    nexus.validateKey(APIKey !== '' ? APIKey : propAPIKey)
      .then((data: IValidateKeyResponse) => {
        this.setState(update(this.state, {
          userId: { $set: data.user_id },
          name: { $set: data.name },
          isPremium: { $set: data.is_premium },
          isSupporter: { $set: data.is_supporter },
          email: { $set: data.email },
        }));
      });
  }

  private handleChangeAPIKey = (event) => {
    this.setState(update(this.state, { statusCode: { $set: '' } }));
    this.setState(update(this.state, { statusCodeMessage: { $set: '' } }));
    this.handleChange(event, 'APIKey');
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return { account: state.account.nexus };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetAPIKey: (APIKey: string) => dispatch(setUserAPIKey(APIKey)),
    onShowLoginError:
      (message: string) => dispatch(showDialog('error', 'Error', { message }, { Close: null })),
  };
}

export default
  translate(['common'], { wait: true })(
    connect(mapStateToProps, mapDispatchToProps)(LoginForm)
  ) as React.ComponentClass<IProps>;
