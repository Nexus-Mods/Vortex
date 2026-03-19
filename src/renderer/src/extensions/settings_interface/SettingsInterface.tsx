import type * as Redux from "redux";
import type { ThunkDispatch } from "redux-thunk";

import PromiseBB from "bluebird";
import * as path from "path";
import * as React from "react";
import {
  Alert,
  Button,
  ControlLabel,
  FormControl,
  FormGroup,
  HelpBlock,
} from "react-bootstrap";
import { useSelector } from "react-redux";

import type { IParameters } from "@vortex/shared/cli";
import type {
  IAvailableExtension,
  IExtensionDownloadInfo,
} from "../../types/extensions";
import type {
  DialogActions,
  DialogType,
  IDialogContent,
  IDialogResult,
} from "../../types/IDialog";
import type { IState } from "../../types/IState";

import { getPreloadApi } from "../../util/preloadAccess";
import { showDialog } from "../../actions/notifications";
import { resetSuppression } from "../../actions/notificationSettings";
import { setCustomTitlebar } from "../../actions/window";
import { ComponentEx, connect, translate } from "../../controls/ComponentEx";
import More from "../../controls/More";
import Toggle from "../../controls/Toggle";
import { relaunch } from "../../util/commandLine";
import getVortexPath from "../../util/getVortexPath";
import { log } from "../../util/log";
import { truthy } from "../../util/util";
import { readExtensibleDir } from "../extension_manager/util";
import getTextModManagement from "../mod_management/texts";
import getTextProfiles from "../profile_management/texts";
import {
  setAutoDeployment,
  setAutoEnable,
  setAutoInstall,
  setAutoStart,
  setStartMinimized,
} from "./actions/automation";
import {
  setAdvancedMode,
  setDesktopNotifications,
  setForegroundDL,
  setHideTopLevelCategory,
  setLanguage,
  setProfilesVisible,
  setRelativeTimes,
} from "./actions/interface";
import { nativeCountryName, nativeLanguageName } from "./languagemap";
import getText from "./texts";

interface ILanguage {
  key: string;
  language: string;
  country?: string;
  ext: Array<Partial<IExtensionDownloadInfo>>;
}

export interface IBaseProps {
  startup: IParameters;
  changeStartup: (key: string, value: any) => void;
}

interface IConnectedProps {
  profilesVisible: boolean;
  autoDeployment: boolean;
  autoInstall: boolean;
  autoEnable: boolean;
  autoStart: boolean;
  startMinimized: boolean;
  advanced: boolean;
  customTitlebar: boolean;
  minimizeToTray: boolean;
  desktopNotifications: boolean;
  hideTopLevelCategory: boolean;
  relativeTimes: boolean;
  suppressedNotifications: { [id: string]: boolean };
  foregroundDL: boolean;
}

interface IActionProps {
  onSetLanguage: (language: string) => void;
  onSetAutoDeployment: (enabled: boolean) => void;
  onSetAutoInstall: (enabled: boolean) => void;
  onSetAutoEnable: (enabled: boolean) => void;
  onSetAutoStart: (start: boolean) => void;
  onSetStartMinimized: (minimized: boolean) => void;
  onSetProfilesVisible: (visible: boolean) => void;
  onSetAdvancedMode: (advanced: boolean) => void;
  onShowDialog: (
    type: DialogType,
    title: string,
    content: IDialogContent,
    actions: DialogActions,
  ) => PromiseBB<IDialogResult>;
  onSetCustomTitlebar: (enable: boolean) => void;
  onSetDesktopNotifications: (enabled: boolean) => void;
  onSetHideTopLevelCategory: (hide: boolean) => void;
  onSetRelativeTimes: (enabled: boolean) => void;
  onResetNotificationSuppression: () => void;
  onSetForegroundDL: (enabled: boolean) => void;
}

type IProps = IBaseProps &
  IActionProps &
  IConnectedProps & {
    currentLanguage: string;
    extensions: IAvailableExtension[];
    languages: ILanguage[];
    onReloadLanguages: () => void;
  };

class SettingsInterfaceImpl extends ComponentEx<IProps, {}> {
  private mInitialTitlebar: boolean;

  constructor(props: IProps) {
    super(props);

    this.mInitialTitlebar = props.customTitlebar;
  }

  public componentDidMount() {
    (this.props.startup as any).attach(this);
  }

  public componentWillUnmount() {
    (this.props.startup as any).detach(this);
  }

  public render(): JSX.Element {
    const {
      t,
      autoDeployment,
      autoEnable,
      autoInstall,
      autoStart,
      currentLanguage,
      customTitlebar,
      desktopNotifications,
      foregroundDL,
      languages,
      profilesVisible,
      hideTopLevelCategory,
      onSetForegroundDL,
      relativeTimes,
      startup,
      startMinimized,
      suppressedNotifications,
    } = this.props;

    const needRestart = customTitlebar !== this.mInitialTitlebar;

    const startMinimizedToggle = autoStart ? (
      <Toggle checked={startMinimized} onToggle={this.toggleMinimized}>
        {t("Start Vortex in the background (Minimized)")}
      </Toggle>
    ) : null;

    const restartNotification = needRestart ? (
      <HelpBlock>
        <Alert>
          {t("You need to restart Vortex to activate this change")}

          <Button style={{ marginLeft: "1em" }} onClick={this.restart}>
            {t("Restart now")}
          </Button>
        </Alert>
      </HelpBlock>
    ) : null;

    const numSuppressed = Object.values(suppressedNotifications).filter(
      (val) => val === true,
    ).length;

    return (
      <form>
        <FormGroup controlId="languageSelect">
          <ControlLabel>{t("Language")}</ControlLabel>

          <FormControl
            componentClass="select"
            value={currentLanguage}
            onChange={this.selectLanguage}
          >
            {languages.reduce((prev, language) => {
              if (language.ext.length < 2) {
                prev.push(this.renderLanguage(language));
              } else {
                language.ext.forEach((ext) =>
                  prev.push(this.renderLanguage(language, ext)),
                );
              }
              return prev;
            }, [])}
          </FormControl>

          <ControlLabel>
            {t(
              "When you select a language for the first time you may have to restart Vortex.",
            )}
          </ControlLabel>
        </FormGroup>

        <FormGroup controlId="customization">
          <ControlLabel>{t("Customisation")}</ControlLabel>

          <div>
            <div>
              <Toggle
                checked={customTitlebar}
                onToggle={this.toggleCustomTitlebar}
              >
                {t("Custom Window Title Bar")}
              </Toggle>
            </div>

            <div>
              <Toggle
                checked={desktopNotifications !== false}
                onToggle={this.toggleDesktopNotifications}
              >
                {t("Enable Desktop Notifications")}
              </Toggle>
            </div>

            <div>
              <Toggle
                checked={hideTopLevelCategory}
                onToggle={this.toggleHideTopLevelCategory}
              >
                {t("Hide Top-Level Category")}

                <More
                  id="more-hide-toplevel-category"
                  name={t("Top-Level Categories")}
                >
                  {getText("toplevel-categories", t)}
                </More>
              </Toggle>
            </div>

            <div>
              <Toggle
                checked={relativeTimes}
                onToggle={this.toggleRelativeTimes}
              >
                {t('Use relative times (e.g. "3 months ago")')}
              </Toggle>
            </div>
          </div>

          <div>
            <Toggle checked={foregroundDL} onToggle={onSetForegroundDL}>
              {t(
                "Bring Vortex to foreground when starting downloads in browser",
              )}
            </Toggle>
          </div>
        </FormGroup>

        <FormGroup controlId="advanced">
          <ControlLabel>{t("Advanced")}</ControlLabel>

          <div>
            {/*
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
            */}
            <div>
              <Toggle checked={profilesVisible} onToggle={this.toggleProfiles}>
                {t("Enable Profile Management")}

                <More
                  id="more-profile-settings"
                  name={t("Profiles")}
                  wikiId="profiles"
                >
                  {getTextProfiles("profiles", t)}
                </More>
              </Toggle>
            </div>

            <div>
              <Toggle
                checked={startup.disableGPU !== true}
                onToggle={this.toggleAcceleration}
              >
                {t("Enable GPU Acceleration")}
              </Toggle>

              {startup.disableGPU === true ? (
                <ControlLabel>
                  <Alert bsStyle="warning">
                    {t(
                      "Disabling GPU acceleration will make the Vortex UI significantly less " +
                        "responsive in places.",
                    )}
                  </Alert>
                </ControlLabel>
              ) : null}
            </div>
          </div>
        </FormGroup>

        <FormGroup controlId="automation">
          <ControlLabel>{t("Automation")}</ControlLabel>

          <div>
            <Toggle
              checked={autoDeployment}
              onToggle={this.toggleAutoDeployment}
            >
              {t("Deploy Mods when Enabled")}

              <More id="more-deploy-settings" name={t("Deployment")}>
                {getTextModManagement("deployment", t)}
              </More>
            </Toggle>

            <Toggle checked={autoInstall} onToggle={this.toggleAutoInstall}>
              {t("Install Mods when downloaded")}
            </Toggle>

            <Toggle checked={autoEnable} onToggle={this.toggleAutoEnable}>
              {t("Enable Mods when installed (in current profile)")}
            </Toggle>

            <Toggle checked={autoStart} onToggle={this.toggleAutoStart}>
              {t("Run Vortex when my computer starts")}
            </Toggle>

            {startMinimizedToggle}
          </div>
        </FormGroup>

        <FormGroup controlId="notifications">
          <ControlLabel>{t("Notifications")}</ControlLabel>

          <div>
            <Button onClick={this.resetSuppression}>
              {t("Reset suppressed notifications")}
            </Button>{" "}
            {t("({{count}} notification is being suppressed)", {
              replace: { count: numSuppressed },
            })}
          </div>
        </FormGroup>

        {restartNotification}
      </form>
    );
  }

  private toggleAcceleration = () => {
    this.props.changeStartup(
      "disableGPU",
      this.props.startup.disableGPU !== true,
    );
  };

  private toggleRelativeTimes = () => {
    this.props.onSetRelativeTimes(!this.props.relativeTimes);
  };

  private selectLanguage = (evt) => {
    const { extensions } = this.props;
    const target: HTMLSelectElement = evt.target as HTMLSelectElement;
    const extName: string = target.selectedOptions[0]?.getAttribute("data-ext");
    if (extName === undefined) {
      // no language selected? How did this happen?
      return;
    }
    const ext: { modId?: number } =
      extensions.find((iter) => iter.name === extName) || {};
    const { value } = target;
    const dlProm: PromiseBB<boolean[]> =
      ext.modId !== undefined
        ? this.context.api
            .emitAndAwait("install-extension", ext)
            .tap((success) =>
              success ? this.props.onReloadLanguages() : PromiseBB.resolve(),
            )
        : PromiseBB.resolve([true]);
    dlProm.then((success: boolean[]) => {
      if (success.indexOf(false) === -1) {
        this.props.onSetLanguage(value);
      }
    });
  };

  private languageName(language: ILanguage): string {
    return language.country === undefined
      ? language.language
      : `${language.language} (${language.country})`;
  }

  private renderLanguage(
    language: ILanguage,
    ext?: Partial<IExtensionDownloadInfo>,
  ): JSX.Element {
    const { t } = this.props;
    if (ext === undefined) {
      ext = language.ext.length > 0 ? language.ext[0] : { name: undefined };
    }
    return (
      <option
        data-ext={ext.name}
        key={`${language.key}-${ext["author"] || "local"}`}
        value={language.key}
      >
        {this.languageName(language)}

        {ext.modId !== undefined
          ? ` (${t("Extension")} by ${ext["author"] || "unknown author"})`
          : null}
      </option>
    );
  }

  private toggleAutoDeployment = () => {
    const { autoDeployment, onSetAutoDeployment } = this.props;
    onSetAutoDeployment(!autoDeployment);
  };

  private toggleAutoInstall = () => {
    const { autoInstall, onSetAutoInstall } = this.props;
    onSetAutoInstall(!autoInstall);
  };

  private toggleAutoEnable = () => {
    const { autoEnable, onSetAutoEnable } = this.props;
    onSetAutoEnable(!autoEnable);
  };

  private toggleAutoStart = () => {
    const { autoStart, startMinimized, onSetAutoStart, onSetStartMinimized } =
      this.props;
    const startOnBoot = !autoStart === true;
    onSetAutoStart(startOnBoot);
    if (!startOnBoot) {
      // We only want to allow the user to start Vortex minimized
      //  if auto start is enabled - easier this way and less chances
      //  for users to forget about this setting and start sending
      //  bug reports.
      onSetStartMinimized(false);
    }
    const api = getPreloadApi();
    api.app.setLoginItemSettings({
      openAtLogin: startOnBoot,
      path: process.execPath, // Yes this is currently needed - thanks Electron
      args: startOnBoot ? (startMinimized ? ["--start-minimized"] : []) : [],
    });
  };

  private toggleMinimized = () => {
    const { autoStart, startMinimized, onSetStartMinimized } = this.props;
    const isMinimized = !startMinimized === true;
    onSetStartMinimized(isMinimized);
    const api = getPreloadApi();
    api.app.setLoginItemSettings({
      openAtLogin: autoStart,
      path: process.execPath, // Yes this is currently needed - thanks Electron
      args: isMinimized ? ["--start-minimized"] : [],
    });
  };

  private resetSuppression = () => {
    const { onResetNotificationSuppression } = this.props;
    onResetNotificationSuppression();
  };

  private toggleDesktopNotifications = () => {
    const { desktopNotifications, onSetDesktopNotifications } = this.props;
    onSetDesktopNotifications(!desktopNotifications);
  };

  private toggleHideTopLevelCategory = () => {
    const { hideTopLevelCategory, onSetHideTopLevelCategory } = this.props;
    onSetHideTopLevelCategory(!hideTopLevelCategory);
  };

  private toggleProfiles = () => {
    const { t, profilesVisible, onSetProfilesVisible, onShowDialog } =
      this.props;
    if (profilesVisible) {
      onShowDialog(
        "question",
        t("Disabling Profile Management"),
        {
          text: t(
            "Please be aware that toggling this only disables the interface for profiles, " +
              "meaning profiles don't get deleted and an active profile doesn't " +
              "get disabled. The last active profile for each game will still be used " +
              "(i.e. its mod selection and local savegames).",
          ),
          options: { translated: true, wrap: true },
        },
        [
          { label: "Cancel" },
          {
            label: "Continue",
            action: () => onSetProfilesVisible(!profilesVisible),
          },
        ],
      );
    } else {
      onSetProfilesVisible(!profilesVisible);
    }
  };

  private toggleCustomTitlebar = () => {
    const { customTitlebar, onSetCustomTitlebar } = this.props;
    onSetCustomTitlebar(!customTitlebar);
  };

  private toggleAdvanced = () => {
    const { advanced, onSetAdvancedMode } = this.props;
    onSetAdvancedMode(!advanced);
  };

  private restart = () => {
    relaunch();
  };
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    profilesVisible: state.settings.interface.profilesVisible,
    hideTopLevelCategory: state.settings.interface.hideTopLevelCategory,
    advanced: state.settings.interface.advanced,
    desktopNotifications: state.settings.interface.desktopNotifications,
    autoDeployment: state.settings.automation.deploy,
    autoInstall: state.settings.automation.install,
    autoEnable: state.settings.automation.enable,
    autoStart: state.settings.automation.start,
    startMinimized: state.settings.automation.minimized,
    customTitlebar: state.settings.window.customTitlebar,
    minimizeToTray: state.settings.window.minimizeToTray,
    relativeTimes: state.settings.interface.relativeTimes,
    suppressedNotifications: state.settings.notifications.suppress,
    foregroundDL: state.settings.interface.foregroundDL,
  };
}

function mapDispatchToProps(
  dispatch: ThunkDispatch<any, null, Redux.Action>,
): IActionProps {
  return {
    onSetLanguage: (newLanguage: string): void => {
      dispatch(setLanguage(newLanguage));
    },
    onSetAutoDeployment: (enabled: boolean) => {
      dispatch(setAutoDeployment(enabled));
    },
    onSetAutoInstall: (enabled: boolean) => {
      dispatch(setAutoInstall(enabled));
    },
    onSetAutoEnable: (enabled: boolean) => {
      dispatch(setAutoEnable(enabled));
    },
    onSetAutoStart: (start: boolean) => {
      dispatch(setAutoStart(start));
    },
    onSetStartMinimized: (minimized: boolean) => {
      dispatch(setStartMinimized(minimized));
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
    onSetRelativeTimes: (enabled: boolean) => {
      dispatch(setRelativeTimes(enabled));
    },
    onResetNotificationSuppression: () => {
      dispatch(resetSuppression(null));
    },
    onSetForegroundDL: (enabled: boolean) => dispatch(setForegroundDL(enabled)),
  };
}

const SettingsInterfaceMapped = translate(["common"])(
  connect(mapStateToProps, mapDispatchToProps)(SettingsInterfaceImpl),
);

function isValidLanguageCode(langId: string) {
  if (!truthy(langId)) {
    return false;
  }
  try {
    new Date().toLocaleString(langId);
    return true;
  } catch (err) {
    log("warn", "Not a valid language code", langId);
    return false;
  }
}

function readLocales(
  extensions: IAvailableExtension[],
): PromiseBB<ILanguage[]> {
  const bundledLanguages = getVortexPath("locales");
  const userLanguages = path.normalize(
    path.join(getVortexPath("userData"), "locales"),
  );

  const translationExts = extensions.filter(
    (ext) => ext.type === "translation",
  );

  let local: string[] = [];

  return PromiseBB.join(
    readExtensibleDir("translation", bundledLanguages, userLanguages)
      .map((file: string) => path.basename(file))
      .tap((files) => (local = files)),
    translationExts.map((ext) => ext.language),
  )
    .then((fileLists) => Array.from(new Set([].concat(...fileLists))))
    .filter((langId: string) => isValidLanguageCode(langId))
    .then((files) => {
      // files contains just the unique languages being supported, but there
      // may be multiple extensions providing the same language
      const loc = new Set(local);
      const locales = files.map((key: string) => {
        let language;
        let country;

        const [languageKey, countryKey] = key.split("-");
        language = nativeLanguageName(languageKey);
        if (countryKey !== undefined) {
          country = nativeCountryName(countryKey);
        }

        const ext: Array<Partial<IAvailableExtension>> = loc.has(key)
          ? []
          : translationExts.filter((iter) => iter.language === key);
        return { key, language, country, ext };
      });

      return locales;
    })
    .catch((err) => {
      log("warn", "failed to read locales", err);
      return [];
    });
}

function SettingsInterface(props: IBaseProps) {
  const [languages, setLanguages] = React.useState<ILanguage[]>([]);
  const [iteration, setIteration] = React.useState<number>(0);

  const { lang, exts } = useSelector<
    IState,
    { lang: string; exts: IAvailableExtension[] }
  >((state) => ({
    lang: state.settings.interface.language,
    exts: state.session.extensions.available,
  }));

  const forceReload = React.useCallback(() => setIteration((i) => i + 1), []);

  React.useEffect(() => {
    (async () => {
      const langs = await readLocales(exts);
      // ensure the selected language is always an option
      if (langs.length === 0) {
        langs.push({
          key: lang,
          language: nativeLanguageName(lang),
          ext: [],
        });
      }
      setLanguages(langs);
    })();
  }, [lang, exts, iteration]);

  return (
    <SettingsInterfaceMapped
      {...props}
      currentLanguage={lang}
      extensions={exts}
      languages={languages}
      onReloadLanguages={forceReload}
    />
  );
}

export default SettingsInterface;
