import { setUserAPIKey, loadUserInfo } from '../actions/account';
import { showDialog } from '../actions/notifications';
import { II18NProps } from '../types/II18NProps';
import { log } from '../util/log';
import { Button } from './TooltipControls';

import { Client } from 'node-rest-client';
import * as React from 'react';
import { ControlLabel, FormControl, FormGroup, Image } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';
import classNames = require('classnames');
import Icon = require('react-fontawesome');
import update = require('react-addons-update');

interface ILoginFormProps {
  onClose: () => void;
}

interface ILoginFormState {
  APIKey: string;
  isSubmitted: boolean;
  user_id: string;
  name: string;
  isPremium: string;
  email: string;
  errorCode: string;
  errorCodeMessage: string;
  isSupporter: string;
}

interface ILoginFormConnectedProps {
    account: any;
}

interface ILoginFormActionProps {
    onSetAPIKey: (APIKey: string) => void;
    onShowLoginError: (message: string) => void;
    onLoadUserInfo: (APIKey: string) => void;
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
        this.state = { APIKey: '', isSubmitted: false, user_id: '', name: '', isPremium: '', email: '', errorCode: '', errorCodeMessage: '', isSupporter: '' };
    }
    
    componentWillMount() {
        if (this.props.account.account.APIKey != '') {
            this.LoadUserInfoImpl();
        }
    }

  public render(): JSX.Element {
      const { t } = this.props;
      const { isSubmitted, APIKey, errorCode } = this.state;
      const APIKeyState = !isSubmitted ? undefined : (APIKey.length > 0 && errorCode != '401') ? 'success' : 'warning';
            
      return (
          <form onSubmit={ this.APIKeyAuthentication } >
              <FormGroup controlId='formUserInfo' onc hidden= { (this.props.account.account.APIKey == '' || this.props.account.account.APIKey == null) ? true : false} onload={(this.props.account.account.APIKey != '' || this.props.account.account.APIKey != null) ? this.LoadUserInfo : null}>
                  <div>
                      <Image src='./images/avatar.png' width='90' height='90' rounded />
                  </div>
                  <div>
                      <ControlLabel>{'User ID: ' + this.state.user_id}</ControlLabel>
                  </div>
                  <div>
                      <ControlLabel>{'UserName: ' + this.state.name}</ControlLabel>
                  </div>
                  <div>
                      <ControlLabel>{'Premium: ' + (this.state.isPremium != "false" ? 'YES' : 'NO') }</ControlLabel>
                  </div>
                  <div>
                      <ControlLabel>{'Supporter: ' + (this.state.isSupporter != "false" ? 'YES' : 'NO') }</ControlLabel>
                  </div>
                  <div>
                      <ControlLabel>{'Email: ' + this.state.email}</ControlLabel>
                  </div>
              </FormGroup>
              <FormGroup controlId='formAPIKeyValidation' validationState={!isSubmitted ? undefined : (APIKey.length > 0 && errorCode != '401') ? 'success' : 'warning'} hidden= { (this.props.account.account.APIKey == '' || this.props.account.account.APIKey == null) ? false : true}>
                  <ControlLabel>{isSubmitted && (APIKey.length === 0) ? 'Missing API Key' : this.state.errorCodeMessage}</ControlLabel>
                  <FormControl
                      type='text'
                      name='APIKey'
                      value={APIKey}
                      placeholder={ t('User APIKey') }
                      onChange={ this.handleChangeAPIKey }
                      />
                  <FormFeedbackAwesome />
                </FormGroup>
              <Button id={this.props.account.account.APIKey === '' ? 'submit-apikey' : 'remove-apikey'} type='submit' tooltip={ this.props.account.account.APIKey === '' ? t('Submit') : t('Remove API Key') }>
                  { this.props.account.account.APIKey === '' ? t('Submit') : t('Remove API Key') }
              </Button>
          </form>
    );
  };
  
  public handleChange(event, field) {
    this.setState(update(this.state, { [field]: { $set: event.target.value } }));
  }

  private APIKeyAuthentication = (event: Event) => {
      event.preventDefault();
      this.APIKeyAuthenticationImpl();
  }

  private APIKeyAuthenticationImpl() {

      let { onClose, onSetAPIKey, onLoadUserInfo } = this.props;
      let { APIKey, errorCode } = this.state;

      if (this.props.account.account.APIKey != '') {
          onSetAPIKey('');
          this.setState(update(this.state, { isSubmitted: { $set: false } }));
          onClose();
      }
      else
      {
          let client = new Client();

          this.setState(update(this.state, { isSubmitted: { $set: true } }));

          let args = {
              headers: {
                  "Content-Type": "application/json",
                  "apikey": this.state.APIKey != '' ? this.state.APIKey : this.props.account.account.APIKey
              }
          };

          if (this.state.APIKey != '') {
              client.get('https://api.nexusmods.com/v1/users/validate.json', args,
                  (data, response) => {

                      if (response.statusCode == 200) {
                          onSetAPIKey(this.state.APIKey);
                          onClose();
                      }

                      if (response.statusCode == 401) {
                          this.setState(update(this.state, { errorCodeMessage: { $set: data.message } }));
                          this.setState(update(this.state, { errorCode: { $set: response.statusCode } }));
                      }

                  });
          }
      }
  }

  public LoadUserInfo = (event: Event) => {
      event.preventDefault();
      this.LoadUserInfoImpl();
  }

  public LoadUserInfoImpl() {
  
      let { onClose, onLoadUserInfo, onShowLoginError } = this.props;
      let { APIKey } = this.state;

      let client = new Client();

      this.setState(update(this.state, { isSubmitted: { $set: true } }));

      let args = {
          headers: {
              "Content-Type": "application/json",
              "apikey": this.state.APIKey != '' ? this.state.APIKey : this.props.account.account.APIKey
          }
      };

      client.get('https://api.nexusmods.com/v1/users/validate.json', args,  
          (data, response) => {
              console.log('debug', 'STATUS', response.statusCode);
              console.log('debug', 'HEADERS', JSON.stringify(response.headers));
              console.log('debug', 'BODY', JSON.stringify(data));
              response.setEncoding('utf8')
              response.on('data', console.log)

              this.setState(update(this.state, { user_id: { $set: data.user_id } })); 
              this.setState(update(this.state, { name: { $set: data.name } })); 
              this.setState(update(this.state, { isPremium: { $set: data.is_premium } })); 
              this.setState(update(this.state, { isSupporter: { $set: data.is_supporter } })); 
              this.setState(update(this.state, { email: { $set: data.email } })); 
          });
  }
     
  private handleChangeAPIKey = (event) =>
  {
      this.setState(update(this.state, { errorCode: { $set: '' } }));
      this.setState(update(this.state, { errorCodeMessage: { $set: '' } }));
      this.handleChange(event, 'APIKey');
  }
}

function mapStateToProps(state: any): ILoginFormConnectedProps {
  return { account: state.account };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): ILoginFormActionProps {
    return {
      onSetAPIKey: (APIKey: string) => dispatch(setUserAPIKey(APIKey)),
      onShowLoginError: (message: string) => dispatch(showDialog('error', 'Error', message)), 
      onLoadUserInfo: (APIKey: string) => dispatch(loadUserInfo(APIKey)),
  };
}

const LoginForm = connect(mapStateToProps, mapDispatchToProps)(LoginFormBase) as React.ComponentClass<ILoginFormProps>;

export default translate(['common'], { wait: true })(LoginForm);
