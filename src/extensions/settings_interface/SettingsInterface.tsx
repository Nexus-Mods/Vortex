import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import { log } from '../../util/log';
import More from '../../views/More';

import getTextModManagement from '../mod_management/texts';
import getTextProfiles from '../profile_management/texts';

import { setAutoDeployment } from './actions/automation';
import { setAdvancedMode, setLanguage, setProfilesVisible } from './actions/interface';
import { nativeCountryName, nativeLanguageName } from './languagemap';
import getText from './texts';

import * as React from 'react';
import {
  Checkbox, ControlLabel, FormControl, FormGroup
} from 'react-bootstrap';

import update = require('react-addons-update');

import { readdir } from 'fs';
import * as path from 'path';

interface ILanguage {
  key: string;
  language: string;
  country?: string;
}

interface IConnectedProps {
  currentLanguage: string;
  profilesVisible: boolean;
  autoDeployment: boolean;
  advanced: boolean;
}

interface IActionProps {
  onSetLanguage: (language: string) => void;
  onSetAutoDeployment: (enabled: boolean) => void;
  onSetProfilesVisible: (visible: boolean) => void;
  onSetAdvancedMode: (advanced: boolean) => void;
}

interface IState {
  languages: ILanguage[];
}

type IProps = IActionProps & IConnectedProps;

class SettingsInterface extends ComponentEx<IProps, IState> {

  constructor(props) {
    super(props);

    this.state = {
      languages: [],
    };

    const localesPath = path.normalize(path.join(__dirname, '..', '..', '..', 'locales'));

    readdir(localesPath, (err, files) => {
      if (err) {
        log('warn', 'failed to read locales', err);
        return;
      }

      const locales = files.map((key) => {
        let language = undefined;
        let country = undefined;

        if (key.includes('-')) {
          let [languageKey, countryKey] = key.split('-');
          language = nativeLanguageName(languageKey);
          country = nativeCountryName(countryKey);
        } else {
          language = nativeLanguageName(key);
        }
        return { key, language, country }; });

      this.setState(update(this.state, {
        languages: { $set: locales },
      }));
    });
  }

  public render(): JSX.Element {
    const { t, advanced, autoDeployment, currentLanguage, profilesVisible } = this.props;

    return (
      <form>
        <FormGroup controlId='languageSelect'>
          <ControlLabel>{t('Language') }</ControlLabel>
          <FormControl
            componentClass='select'
            onChange={this.selectLanguage}
            value={currentLanguage}
          >
            { this.state.languages.map((language) => { return this.renderLanguage(language); }) }
          </FormControl>
        </FormGroup>
        <FormGroup controlId='advanced'>
          <ControlLabel>{t('Advanced')}</ControlLabel>
          <div>
            <div>
              <Checkbox
                checked={advanced}
                onChange={this.toggleAdvanced}
                style={{ display: 'inline' }}
              >
                {t('Enable advanced mode')}
              </Checkbox>
              <More id='more-advanced-settings' name={t('Advanced')}>
                {getText('advanced', t)}
              </More>
            </div>
            <div>
              <Checkbox
                checked={profilesVisible}
                onChange={this.toggleProfiles}
                style={{ display: 'inline' }}
              >
                {t('Enable Profile management')}
              </Checkbox>
              <More id='more-profile-settings' name={t('Profiles')}>
                {getTextProfiles('profiles', t)}
              </More>
            </div>
          </div>
        </FormGroup>
        <FormGroup controlId='automation'>
          <ControlLabel>{t('Automation')}</ControlLabel>
          <div>
            <Checkbox
              checked={autoDeployment}
              onChange={this.toggleAutoDeployment}
              style={{ display: 'inline' }}
            >
              {t('Deploy mods immediately when they get enabled')}
            </Checkbox>
            <More id='more-deploy-settings' name={t('Deployment')}>
              {getTextModManagement('deployment', t)}
            </More>
          </div>
        </FormGroup>
      </form>
    );
  }

  private selectLanguage = (evt) => {
    let target: HTMLSelectElement = evt.target as HTMLSelectElement;
    this.props.onSetLanguage(target.value);
  }

  private languageName(language: ILanguage): string {
    return language.country === undefined
      ? language.language
      : `${language.language} (${language.country})`;
  }

  private renderLanguage(language: ILanguage): JSX.Element {
    return (
      <option key={language.key} value={language.key}>
      { this.languageName(language) }
      </option>
    );
  }

  private toggleAutoDeployment = () => {
    const { autoDeployment, onSetAutoDeployment } = this.props;
    onSetAutoDeployment(!autoDeployment);
  }

  private toggleProfiles = () => {
    const { profilesVisible, onSetProfilesVisible } = this.props;
    onSetProfilesVisible(!profilesVisible);
  }

  private toggleAdvanced = () => {
    const { advanced, onSetAdvancedMode } = this.props;
    onSetAdvancedMode(!advanced);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    currentLanguage: state.settings.interface.language,
    profilesVisible: state.settings.interface.profilesVisible,
    advanced: state.settings.interface.advanced,
    autoDeployment: state.settings.automation.deploy,
  };
}

function mapDispatchToProps(dispatch: Function): IActionProps {
  return {
    onSetLanguage: (newLanguage: string): void => {
      dispatch(setLanguage(newLanguage));
    },
    onSetAutoDeployment: (enabled: boolean) => {
      dispatch(setAutoDeployment(enabled));
    },
    onSetProfilesVisible: (visible: boolean) => {
      dispatch(setProfilesVisible(visible));
    },
    onSetAdvancedMode: (advanced: boolean) => {
      dispatch(setAdvancedMode(advanced));
    },
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      SettingsInterface
    )
  );
