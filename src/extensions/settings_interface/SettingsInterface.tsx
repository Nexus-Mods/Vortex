import { showDialog } from '../../actions/notifications';
import { setCustomTitlebar } from '../../actions/window';

import More from '../../controls/More';
import Toggle from '../../controls/Toggle';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../types/IDialog';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import { readdirAsync } from '../../util/fs';
import getVortexPath from '../../util/getVortexPath';
import { log } from '../../util/log';
import { spawnSelf } from '../../util/util';

import getTextModManagement from '../mod_management/texts';
import getTextProfiles from '../profile_management/texts';

import { setAutoDeployment } from './actions/automation';
import { setAdvancedMode, setLanguage, setProfilesVisible } from './actions/interface';
import { nativeCountryName, nativeLanguageName } from './languagemap';
import getText from './texts';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as update from 'immutability-helper';
import * as path from 'path';
import * as React from 'react';
import { Alert, Button, ControlLabel,
         FormControl, FormGroup, HelpBlock } from 'react-bootstrap';
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
  customTitlebar: boolean;
  minimizeToTray: boolean;
}

interface IActionProps {
  onSetLanguage: (language: string) => void;
  onSetAutoDeployment: (enabled: boolean) => void;
  onSetProfilesVisible: (visible: boolean) => void;
  onSetAdvancedMode: (advanced: boolean) => void;
  onShowDialog: (type: DialogType, title: string,
                 content: IDialogContent, actions: DialogActions) => Promise<IDialogResult>;
  onSetCustomTitlebar: (enable: boolean) => void;
}

interface IState {
  languages: ILanguage[];
}

type IProps = IActionProps & IConnectedProps;

class SettingsInterface extends ComponentEx<IProps, IState> {
  private mInitialTitlebar: boolean;

  constructor(props: IProps) {
    super(props);

    this.state = {
      languages: [],
    };
    this.mInitialTitlebar = props.customTitlebar;
  }

  public componentDidMount() {
    const bundledLanguages = getVortexPath('locales');
    const userLanguages = path.normalize(path.join(remote.app.getPath('userData'), 'locales'));

    Promise.join(readdirAsync(bundledLanguages), readdirAsync(userLanguages).catch(() => []))
      .then(fileLists => Array.from(new Set([].concat(...fileLists))))
      .then(files => {
        const locales = files.map(key => {
          let language;
          let country;

          if (key.includes('-')) {
            const [languageKey, countryKey] = key.split('-');
            language = nativeLanguageName(languageKey);
            country = nativeCountryName(countryKey);
          } else {
            language = nativeLanguageName(key);
          }
          return { key, language, country };
        });

        this.setState(update(this.state, {
          languages: { $set: locales },
        }));
      })
    .catch(err => {
      log('warn', 'failed to read locales', err);
    });
  }

  public componentWillReceiveProps(newProps: IProps) {
    if (this.state.languages.find(lang => lang.key === newProps.currentLanguage) === undefined) {
      this.setState(update(this.state, {
        languages: { $push: [{
          key: newProps.currentLanguage,
          language: nativeLanguageName(newProps.currentLanguage),
        }] },
      }));
    }
  }

  public render(): JSX.Element {
    const { t, advanced, autoDeployment, currentLanguage,
            customTitlebar, minimizeToTray, profilesVisible } = this.props;

    const needRestart = (customTitlebar !== this.mInitialTitlebar);

    const restartNotification = needRestart ? (
      <HelpBlock>
        <Alert>
          {t('You need to restart Vortex to activate this change')}
          <Button onClick={this.restart} style={{ marginLeft: '1em' }}>{t('Restart now')}</Button>
        </Alert>
      </HelpBlock>
    ) : null;

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
        <FormGroup controlId='customization'>
          <ControlLabel>{t('Customization')}</ControlLabel>
          <div>
            <div>
              <Toggle
                checked={customTitlebar}
                onToggle={this.toggleCustomTitlebar}
              >
                {t('Custom Window Titlebar')}
              </Toggle>
            </div>
          </div>
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
        {restartNotification}
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
    const { t, profilesVisible, onSetProfilesVisible, onShowDialog } = this.props;
    if (profilesVisible) {
      onShowDialog('question', t('Disabling Profile Management'), {
        message: t('Please be aware that toggling this only disables the interface for profiles, '
                 + 'meaning profiles don\'t get deleted and an active profile doesn\'t '
                 + 'get disabled. The last active profile for each game will still be used '
                 + '(i.e. its mod selection and local savegames).'),
        options: { translated: true, wrap: true },
      }, [
        { label: 'Cancel' },
        { label: 'Continue', action: () => onSetProfilesVisible(!profilesVisible) },
      ]);
    } else {
      onSetProfilesVisible(!profilesVisible);
    }
  }

  private toggleCustomTitlebar = () => {
    const { customTitlebar, onSetCustomTitlebar } = this.props;
    onSetCustomTitlebar(!customTitlebar);
  }

  private toggleAdvanced = () => {
    const { advanced, onSetAdvancedMode } = this.props;
    onSetAdvancedMode(!advanced);
  }

  private restart = () => {
    spawnSelf(['--wait']);
    remote.app.exit(0);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    currentLanguage: state.settings.interface.language,
    profilesVisible: state.settings.interface.profilesVisible,
    advanced: state.settings.interface.advanced,
    autoDeployment: state.settings.automation.deploy,
    customTitlebar: state.settings.window.customTitlebar,
    minimizeToTray: state.settings.window.minimizeToTray,
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
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
    onSetCustomTitlebar: (enable: boolean) =>
      dispatch(setCustomTitlebar(enable)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      SettingsInterface)) as React.ComponentClass<{}>;
