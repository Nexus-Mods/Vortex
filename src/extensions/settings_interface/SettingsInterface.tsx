import More from '../../controls/More';
import Toggle from '../../controls/Toggle';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import { log } from '../../util/log';

import getTextModManagement from '../mod_management/texts';
import getTextProfiles from '../profile_management/texts';

import { setAutoDeployment } from './actions/automation';
import { setAdvancedMode, setLanguage, setProfilesVisible } from './actions/interface';
import { nativeCountryName, nativeLanguageName } from './languagemap';
import getText from './texts';

import { readdir } from 'fs';
import * as update from 'immutability-helper';
import * as path from 'path';
import * as React from 'react';
import { Checkbox, ControlLabel, FormControl, FormGroup } from 'react-bootstrap';
import * as Redux from 'redux';

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
        let language;
        let country;

        if (key.includes('-')) {
          const [languageKey, countryKey] = key.split('-');
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
          <ControlLabel>{t('Language')}</ControlLabel>
          <FormControl
            componentClass='select'
            onChange={this.selectLanguage}
            value={currentLanguage}
          >
            {this.state.languages.map((language) => this.renderLanguage(language))}
          </FormControl>
        </FormGroup>
        <FormGroup controlId='advanced'>
          <ControlLabel>{t('Advanced')}</ControlLabel>
          <div>
            <div>
              <Toggle
                checked={advanced}
                onToggle={this.toggleAdvanced}
              >
                {t('Enable advanced mode')}
                <More id='more-advanced-settings' name={t('Advanced')}>
                  {getText('advanced', t)}
                </More>
              </Toggle>
            </div>
            <div>
              <Toggle
                checked={profilesVisible}
                onToggle={this.toggleProfiles}
              >
                {t('Enable Profile management')}
                <More id='more-profile-settings' name={t('Profiles')}>
                  {getTextProfiles('profiles', t)}
                </More>
              </Toggle>
            </div>
          </div>
        </FormGroup>
        <FormGroup controlId='automation'>
          <ControlLabel>{t('Automation')}</ControlLabel>
          <div>
            <Toggle
              checked={autoDeployment}
              onToggle={this.toggleAutoDeployment}
            >
              {t('Deploy mods immediately when they get enabled')}
              <More id='more-deploy-settings' name={t('Deployment')}>
                {getTextModManagement('deployment', t)}
              </More>
            </Toggle>
          </div>
        </FormGroup>
      </form>
    );
  }

  private selectLanguage = (evt) => {
    const target: HTMLSelectElement = evt.target as HTMLSelectElement;
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
      {this.languageName(language)}
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

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
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
      SettingsInterface)) as React.ComponentClass<{}>;
