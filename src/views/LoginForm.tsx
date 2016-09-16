import { setLoggedInUser } from '../actions/actions';
import { II18NProps } from '../types/II18NProps';
import { log } from '../util/log';
import { showError } from '../util/message';
import { Button } from './TooltipControls';

import { Client } from 'node-rest-client';
import * as React from 'react';
import { ControlLabel, FormControl, FormGroup } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';
import classNames = require('classnames');
import Icon = require('react-fontawesome');
import update = require('react-addons-update');

interface ILoginFormProps {
  onClose: () => void;
}

interface ILoginFormState {
  username: string;
  password: string;
  isSubmitted: boolean;
}

interface ILoginFormConnectedProps {
  account: any;
}

interface ILoginFormActionProps {
  onSetAccount: (username: string, sid: string) => void;
  onShowError: (message: string, details: string) => void;
}

class FormFeedbackAwesome extends FormControl.Feedback {
  protected renderDefaultFeedback(formGroup, className, classes, elementProps) {
    let iconName = this.iconName(formGroup && formGroup.validationState);
    if (iconName === undefined) {
      return null;
    } else {
      return <div {...elementProps} className={classNames(className, classes)}><Icon name={iconName} /></div>;
    }
  }

  private iconName(state: string): string {
    switch (state) {
      case 'success': return 'check';
      case 'warning': return 'warning';
      case 'error': return 'remove';
      default: return undefined;
    }
  }
}

class LoginFormBase extends React.Component<
  ILoginFormProps & ILoginFormConnectedProps & ILoginFormActionProps & II18NProps, ILoginFormState> {
  constructor(props) {
    super(props);
    this.state = { username: '', password: '', isSubmitted: false };
  }

  public render(): JSX.Element {
    const { t } = this.props;
    const { isSubmitted, username, password } = this.state;

    const usernameState = !isSubmitted ? undefined : (username.length > 0) ? 'success' : 'warning';

    return (
      <form onSubmit={ this.LoginAuthentication } >
        <FormGroup controlId='formUsernameValidation' validationState={usernameState} >
          <ControlLabel>{usernameState === 'warning' ? 'Missing username' : ''}</ControlLabel>
          <FormControl
            type='text'
            name='username'
            value={ username }
            placeholder={ t('Nexus Accountname') }
            onChange={ this.handleChangeUsername }
          />
          <FormFeedbackAwesome />
        </FormGroup>
        <FormGroup
          controlId='formPasswordValidation'
          validationState={!isSubmitted ? undefined : (password.length > 0) ? 'success' : 'warning'}
        >
          <ControlLabel>{isSubmitted && (password.length === 0) ? 'Missing password' : ''}</ControlLabel>
          <FormControl
            type='password'
            name='password'
            value={password}
            placeholder={ t('Nexus Password') }
            onChange={ this.handleChangePassword }
          />
          <FormFeedbackAwesome />
        </FormGroup>
        <Button id='submit-login' type='submit' tooltip={ t('Submit') }>
          { t('Submit') }
        </Button>
      </form>
    );
  };

  public handleChange(event, field) {
    this.setState(update(this.state, { [field]: { $set: event.target.value } }));
  }

  private LoginAuthenticationImpl() {
    let { onClose, onSetAccount, onShowError } = this.props;
    let { username, password } = this.state;

    let client = new Client();

    this.setState(update(this.state, { isSubmitted: { $set: true } }));

    let args = {
      path: { username, password },
      parameters: { Login: null, username, password },
      headers: { 'user-agent': 'Nexus Client v0.62.28' },
    };

    client.get('http://nmm.nexusmods.com/Sessions/', args,
      (data, response) => {
        log('debug', 'STATUS', response.statusCode);
        log('debug', 'HEADERS', JSON.stringify(response.headers));

        let cookies = response.headers['set-cookie'];

        if (cookies !== undefined) {
          let fields: string[] = cookies[0].split(';');
          let sid = fields
            .find((field) => field.startsWith('sid='))
            .split('=')
          [1];
          log('debug', 'SID', sid);

          onSetAccount(username, sid);

          response.setEncoding('utf8');
          response.on('data', (chunk) => {
            log('debug', 'BODY', chunk);
          });

          onClose();
        } else {
          onShowError('Failed to log in', JSON.stringify(response.headers));
        }
      });
  }

  private LoginAuthentication = (event: Event) => {
    event.preventDefault();
    this.LoginAuthenticationImpl();
  }

  private handleChangeUsername = (event) => this.handleChange(event, 'username');
  private handleChangePassword = (event) => this.handleChange(event, 'password');
}

function mapStateToProps(state: any): ILoginFormConnectedProps {
  return { account: state.account };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): ILoginFormActionProps {
  return {
    onSetAccount: (username: string, sid: string) => dispatch(setLoggedInUser(username, sid)),
    onShowError: (message: string, details: string) => showError(dispatch, message, details),
  };
}

const LoginForm = connect(mapStateToProps, mapDispatchToProps)(LoginFormBase) as React.ComponentClass<ILoginFormProps>;

export default translate(['common'], { wait: true })(LoginForm);
