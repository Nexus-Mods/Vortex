import { setUserAPIKey } from '../actions/account';
import { showDialog } from '../actions/notifications';
import { IAccount, IState } from '../types/IState';
import { ComponentEx, connect, translate } from '../util/ComponentEx';
import { log } from '../util/log';
import { Button } from './TooltipControls';

import { Client } from 'node-rest-client';
import * as React from 'react';
import { ControlLabel, FormControl, FormGroup, Image } from 'react-bootstrap';
import classNames = require('classnames');
import Icon = require('react-fontawesome');
import update = require('react-addons-update');

interface IProps {
  onClose: () => void;
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

class FormFeedbackAwesome extends FormControl.Feedback {
  protected renderDefaultFeedback(formGroup, className, classes, elementProps) {
    let icon: JSX.Element = this.iconName(formGroup && formGroup.validationState);
    if (icon === undefined) {
      return null;
    } else {
      return (
        <div {...elementProps} className={classNames(className, classes) }>
          { icon }
        </div>
      );
    }
  }

  private iconName(state: string): JSX.Element {
    switch (state) {
      case 'success': return <Icon name='check' />;
      case 'warning': return <Icon name='warning' />;
      case 'error': return <Icon name='remove' />;
      case 'pending': return <Icon name='spinner' spin />;
      default: return undefined;
    }
  }
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
    const { onClose, onSetAPIKey } = this.props;
    const { APIKey } = this.state;
    const propAPIKey = this.props.account.APIKey;

    if (propAPIKey !== '') {
      onSetAPIKey('');
      this.setState(update(this.state, { isSubmitted: { $set: false } }));
      onClose();
    } else {
      let client = new Client();

      this.setState(update(this.state, {
        isSubmitted: { $set: true },
        statusCode: { $set: null },
        statusCodeMessage: { $set: '' },
      }));

      let args = {
        headers: {
          'Content-Type': 'application/json',
          apikey: this.state.APIKey !== '' ? this.state.APIKey : propAPIKey,
        },
      };

      if (APIKey !== '') {
        client.get('https://api.nexusmods.com/v1/users/validate.json', args,
          (data, response) => {
            if (response.statusCode === 200) {
              onSetAPIKey(this.state.APIKey);
              onClose();
            } else {
              this.setState(update(this.state, {
                statusCode: { $set: response.statusCode },
                statusCodeMessage: { $set: data.message },
              }));
            }
          });
      }
    }
  }

  private loadUserInfo() {
    const { APIKey } = this.state;
    const propAPIKey = this.props.account.APIKey;

    let client = new Client();

    this.setState(update(this.state, { isSubmitted: { $set: true } }));

    let args = {
      headers: {
        'Content-Type': 'application/json',
        apikey: APIKey !== '' ? APIKey : propAPIKey,
      },
    };

    client.get('https://api.nexusmods.com/v1/users/validate.json', args,
      (data, response) => {
        log('debug', 'STATUS', response.statusCode);
        log('debug', 'HEADERS', JSON.stringify(response.headers));
        log('debug', 'BODY', JSON.stringify(data));
        response.setEncoding('utf8');
        response.on('data', (responseData) => {
          log('debug', 'response data', responseData);
        });

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

function mapStateToProps(state: IState): IConnectedProps {
  return { account: state.account.base };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetAPIKey: (APIKey: string) => dispatch(setUserAPIKey(APIKey)),
    onShowLoginError: (message: string) => dispatch(showDialog('error', 'Error', message)),
  };
}

export default
  translate(['common'], { wait: true })(
    connect(mapStateToProps, mapDispatchToProps)(LoginForm)
  ) as React.ComponentClass<IProps>;
