import { showDialog } from '../../actions/notifications';
import { setCustomTitlebar } from '../../actions/window';

import More from '../../controls/More';
import Toggle from '../../controls/Toggle';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../types/IDialog';
import { IState } from '../../types/IState';
import { IParameters, relaunch } from '../../util/commandLine';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import getVortexPath from '../../util/getVortexPath';
import { log } from '../../util/log';
import { truthy } from '../../util/util';

import { IAvailableExtension, IExtensionDownloadInfo } from '../extension_manager/types';
import { readExtensibleDir } from '../extension_manager/util';
import getTextModManagement from '../mod_management/texts';
import getTextProfiles from '../profile_management/texts';

import { setAutoDeployment, setAutoEnable } from './actions/automation';
import { setAdvancedMode, setDesktopNotifications, setHideTopLevelCategory,
         setLanguage, setProfilesVisible } from './actions/interface';
import { nativeCountryName, nativeLanguageName } from './languagemap';
import getText from './texts';

import Promise from 'bluebird';
import { remote } from 'electron';
import update from 'immutability-helper';
import * as path from 'path';
import * as React from 'react';
import { Alert, Button, ControlLabel,
         FormControl, FormGroup, HelpBlock } from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

interface ILanguage {
  key: string;
  language: string;
  country?: string;
  ext: IExtensionDownloadInfo | {};
}

interface IBaseProps {
  startup: IParameters;
  changeStartup: (key: string, value: any) => void;
}

interface IConnectedProps {
  currentLanguage: string;
  profilesVisible: boolean;
  autoDeployment: boolean;
  autoEnable: boolean;
  advanced: boolean;
  customTitlebar: boolean;
  minimizeToTray: boolean;
  desktopNotifications: boolean;
  hideTopLevelCategory: boolean;
  extensions: IAvailableExtension[];
}

interface IActionProps {
  onSetLanguage: (language: string) => void;
  onSetAutoDeployment: (enabled: boolean) => void;
  onSetAutoEnable: (enabled: boolean) => void;
  onSetProfilesVisible: (visible: boolean) => void;
  onSetAdvancedMode: (advanced: boolean) => void;
  onShowDialog: (type: DialogType, title: string,
                 content: IDialogContent, actions: DialogActions) => Promise<IDialogResult>;
  onSetCustomTitlebar: (enable: boolean) => void;
  onSetDesktopNotifications: (enabled: boolean) => void;
  onSetHideTopLevelCategory: (hide: boolean) => void;
}

interface IComponentState {
  languages: ILanguage[];
}

type IProps = IBaseProps & IActionProps & IConnectedProps;

class SettingsInterface extends ComponentEx<IProps, IComponentState> {
  private mInitialTitlebar: boolean;

  constructor(props: IProps) {
    super(props);

    this.state = {
      languages: [],
    };
    this.mInitialTitlebar = props.customTitlebar;
  }

  public componentDidMount() {
    (this.props.startup as any).attach(this);
    this.readLocales(this.props);
  }

  public componentWillReceiveProps(newProps: IProps) {
    if (this.state.languages.find(lang => lang.key === newProps.currentLanguage) === undefined) {
      this.setState(update(this.state, {
        languages: { $push: [{
          key: newProps.currentLanguage,
          language: nativeLanguageName(newProps.currentLanguage),
          ext: {},
        }] },
      }));
    }

    if (this.props.extensions !== newProps.extensions) {
      this.readLocales(newProps);
    }
  }

  public render(): JSX.Element {
    const { t, advanced, autoDeployment, autoEnable, currentLanguage,
            customTitlebar, desktopNotifications, profilesVisible,
            hideTopLevelCategory, startup } = this.props;

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
            {this.state.languages.map(language => this.renderLanguage(language))}
          </FormControl>
        </FormGroup>
        <FormGroup controlId='customization'>
          <ControlLabel>{t('Customisation')}</ControlLabel>
          <div>
            <div>
              <Toggle
                checked={customTitlebar}
                onToggle={this.toggleCustomTitlebar}
              >
                {t('Custom Window Title Bar')}
              </Toggle>
            </div>
            <div>
              <Toggle
                checked={desktopNotifications !== false}
                onToggle={this.toggleDesktopNotifications}
              >
                {t('Enable Desktop Notifications')}
              </Toggle>
            </div>
            <div>
              <Toggle
                checked={hideTopLevelCategory}
                onToggle={this.toggleHideTopLevelCategory}
              >
                {t('Hide Top-Level Category')}
                <More id='more-hide-toplevel-category' name={t('Top-Level Categories')}>
                  {getText('toplevel-categories', t)}
                </More>
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
                {t('Enable Advanced Mode')}
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
                {t('Enable Profile Management')}
                <More id='more-profile-settings' name={t('Profiles')} wikiId='profiles'>
                  {getTextProfiles('profiles', t)}
                </More>
              </Toggle>
            </div>
            <div>
              <Toggle
                checked={startup.disableGPU !== true}
                onToggle={this.toggleAcceleration}
              >
                {t('Enable GPU Acceleration')}
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
              {t('Deploy Mods when Enabled')}
              <More id='more-deploy-settings' name={t('Deployment')}>
                {getTextModManagement('deployment', t)}
              </More>
            </Toggle>
            <Toggle
              checked={autoEnable}
              onToggle={this.toggleAutoEnable}
            >
              {t('Enable Mods when installed (in current profile)')}
            </Toggle>
          </div>
        </FormGroup>
        {restartNotification}
      </form>
    );
  }

  private isValidLanguageCode(langId: string) {
    if (!truthy(langId)) {
      return false;
    }
    try {
      new Date().toLocaleString(langId);
      return true;
    } catch (err) {
      log('warn', 'Not a valid language code', langId);
      return false;
    }
  }

  private toggleAcceleration = () => {
    this.props.changeStartup('disableGPU', this.props.startup.disableGPU !== true);
  }

  private selectLanguage = (evt) => {
    const { extensions } = this.props;
    const target: HTMLSelectElement = evt.target as HTMLSelectElement;
    const extName: string = target.selectedOptions[0].getAttribute('data-ext');
    const ext: { modId?: number } = extensions.find(iter => iter.name === extName) || {};
    const { value } = target;
    const dlProm: Promise<boolean[]> = ext.modId !== undefined
      ? this.context.api.emitAndAwait('install-extension', ext)
        .tap(success => success ? this.readLocales(this.props) : Promise.resolve())
      : Promise.resolve([true]);
    dlProm.then((success: boolean[]) => {
      if (success.indexOf(false) === -1) {
        this.props.onSetLanguage(value);
      }
    });
  }

  private languageName(language: ILanguage): string {
    return language.country === undefined
      ? language.language
      : `${language.language} (${language.country})`;
  }

  private renderLanguage(language: ILanguage): JSX.Element {
    const { t } = this.props;
    return (
      <option
        key={language.key}
        value={language.key}
        data-ext={(language.ext as IExtensionDownloadInfo).name}
      >
      {this.languageName(language)}
      {(language.ext['modId'] !== undefined) ? ` (${t('Extension')})` : null}
      </option>
    );
  }

  private toggleAutoDeployment = () => {
    const { autoDeployment, onSetAutoDeployment } = this.props;
    onSetAutoDeployment(!autoDeployment);
  }

  private toggleAutoEnable = () => {
    const { autoEnable, onSetAutoEnable } = this.props;
    onSetAutoEnable(!autoEnable);
  }

  private toggleDesktopNotifications = () => {
    const { desktopNotifications, onSetDesktopNotifications } = this.props;
    onSetDesktopNotifications(!desktopNotifications);
  }

  private toggleHideTopLevelCategory = () => {
    const { hideTopLevelCategory, onSetHideTopLevelCategory } = this.props;
    onSetHideTopLevelCategory(!hideTopLevelCategory);
  }

  private toggleProfiles = () => {
    const { t, profilesVisible, onSetProfilesVisible, onShowDialog } = this.props;
    if (profilesVisible) {
      onShowDialog('question', t('Disabling Profile Management'), {
        text: t('Please be aware that toggling this only disables the interface for profiles, '
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

  private readLocales(props: IProps) {
    const { extensions } = props;
    const bundledLanguages = getVortexPath('locales');
    const userLanguages = path.normalize(path.join(remote.app.getPath('userData'), 'locales'));

    const translationExts = extensions.filter(ext => ext.type === 'translation');

    let local: string[] = [];

    return Promise.join(readExtensibleDir('translation', bundledLanguages, userLanguages)
                          .map(file => path.basename(file))
                          .tap(files => local = files),
                        translationExts.map(ext => ext.language))
      .then(fileLists => Array.from(new Set([].concat(...fileLists))))
      .filter(langId => this.isValidLanguageCode(langId))
      .then(files => {
        const loc = new Set(local);
        const locales = files.map(key => {
          let language;
          let country;

          const [languageKey, countryKey] = key.split('-');
          language = nativeLanguageName(languageKey);
          if (countryKey !== undefined) {
            country = nativeCountryName(countryKey);
          }

          const ext: Partial<IAvailableExtension> = loc.has(key)
            ? {}
            : translationExts.find(iter => iter.language === key);
          return { key, language, country, ext };
        });

        this.setState(update(this.state, {
          languages: { $set: locales },
        }));
      })
    .catch(err => {
      log('warn', 'failed to read locales', err);
    });
  }

  private restart = () => {
    relaunch();
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    currentLanguage: state.settings.interface.language,
    profilesVisible: state.settings.interface.profilesVisible,
    hideTopLevelCategory: state.settings.interface.hideTopLevelCategory,
    advanced: state.settings.interface.advanced,
    desktopNotifications: state.settings.interface.desktopNotifications,
    autoDeployment: state.settings.automation.deploy,
    autoEnable: state.settings.automation.enable,
    customTitlebar: state.settings.window.customTitlebar,
    minimizeToTray: state.settings.window.minimizeToTray,
    extensions: state.session.extensions.available,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetLanguage: (newLanguage: string): void => {
      dispatch(setLanguage(newLanguage));
    },
    onSetAutoDeployment: (enabled: boolean) => {
      dispatch(setAutoDeployment(enabled));
    },
    onSetAutoEnable: (enabled: boolean) => {
      dispatch(setAutoEnable(enabled));
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
    onSetDesktopNotifications: (enabled: boolean) => {
      dispatch(setDesktopNotifications(enabled));
    },
    onSetHideTopLevelCategory: (skip: boolean) => {
      dispatch(setHideTopLevelCategory(skip));
    },
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(
      SettingsInterface)) as React.ComponentClass<{}>;
