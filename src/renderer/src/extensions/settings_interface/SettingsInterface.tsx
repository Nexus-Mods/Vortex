import { readdir } from "node:fs/promises";
import * as path from "path";

import { getErrorCode } from "@vortex/shared";
import type { IParameters } from "@vortex/shared/cli";
import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ControlLabel, FormGroup } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { resetSuppression, setCustomTitlebar, showDialog } from "@/actions";
import { useMainContext } from "@/contexts";
import type { IAvailableExtension } from "@/types/extensions";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { Picker } from "@/ui/components/picker/Picker";
import { Typography } from "@/ui/components/typography/Typography";
import { relaunch } from "@/util/commandLine";
import { log } from "@/util/log";
import { getPreloadApi } from "@/util/preloadAccess";
import { useReduceMotion } from "@/util/reduceMotion";

import { displayBcp47, isValidBcp47 } from "../../bcp47";
import More from "../../controls/More";
import Toggle from "../../controls/Toggle";
import getVortexPath from "../../util/getVortexPath";
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
  setAlwaysCompactHeaders,
  setDesktopNotifications,
  setForegroundDL,
  setHideTopLevelCategory,
  setLanguage,
  setProfilesVisible,
  setReduceMotion,
  setRelativeTimes,
} from "./actions/interface";
import { buildLanguageOptions, type ILanguage, type ILanguageOption } from "./languageOptions";
import getText from "./texts";

export interface IBaseProps {
  startup: IParameters;
  changeStartup: (key: string, value: any) => void;
}

interface IFormProps extends IBaseProps {
  currentLanguage: string;
  extensions: IAvailableExtension[];
  languages: ILanguage[];
  onReloadLanguages: () => void;
}

function SettingsInterfaceForm(props: IFormProps) {
  const { changeStartup, startup } = props;
  const { t } = useTranslation(["common"]);
  const dispatch = useDispatch();
  const { api } = useMainContext();

  const profilesVisible = useSelector((state: IState) => state.settings.interface.profilesVisible);
  const hideTopLevelCategory = useSelector(
    (state: IState) => state.settings.interface.hideTopLevelCategory,
  );
  const desktopNotifications = useSelector(
    (state: IState) => state.settings.interface.desktopNotifications,
  );
  const relativeTimes = useSelector((state: IState) => state.settings.interface.relativeTimes);
  const alwaysCompactHeaders = useSelector(
    (state: IState) => state.settings.interface.alwaysCompactHeaders === true,
  );
  const foregroundDL = useSelector((state: IState) => state.settings.interface.foregroundDL);
  const autoDeployment = useSelector((state: IState) => state.settings.automation.deploy);
  const autoInstall = useSelector((state: IState) => state.settings.automation.install);
  const autoEnable = useSelector((state: IState) => state.settings.automation.enable);
  const autoStart = useSelector((state: IState) => state.settings.automation.start);
  const startMinimized = useSelector((state: IState) => state.settings.automation.minimized);
  const customTitlebar = useSelector((state: IState) => state.settings.window.customTitlebar);
  const suppressedNotifications = useSelector(
    (state: IState) => state.settings.notifications.suppress,
  );

  // Effective rather than stored, so the toggle shows what the OS asked for until the
  // user makes a choice of their own.
  const reduceMotion = useReduceMotion();

  // Captured once on mount, like the class component's constructor did, so a change made
  // during this session can be compared against the value Vortex started with.
  const initialTitlebarRef = useRef(customTitlebar);
  const needRestart = customTitlebar !== initialTitlebarRef.current;

  // `startup` is a makeReactive() proxy: mutating it calls `setState({})` on every attached
  // subscriber, which is how the class component re-rendered on external changes to it.
  const [, forceStartupUpdate] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const listener = { setState: () => forceStartupUpdate() };
    (startup as any).attach(listener);
    return () => (startup as any).detach(listener);
  }, [startup]);

  const languageOptions: ILanguageOption[] = buildLanguageOptions(props.languages, t);
  // Show the current language; a language may appear under more than one option (one
  // per extension), so pick the first matching entry as the native <select> did.
  const selectedLanguageId =
    languageOptions.find((option) => option.key === props.currentLanguage)?.id ?? "";

  const selectLanguage = async (id: string) => {
    const option = languageOptions.find((iter) => iter.id === id);
    if (option === undefined) {
      // no language selected? How did this happen?
      return;
    }
    // extName carries what the old <option data-ext> did: when the language is provided
    // by an extension with a modId, selecting it installs that extension on demand and
    // reloads the language list before applying the language.
    const ext: { modId?: number } =
      props.extensions.find((iter) => iter.name === option.extName) || {};

    const success: boolean[] =
      ext.modId !== undefined ? await api.emitAndAwait<boolean>("install-extension", ext) : [true];

    if (ext.modId !== undefined && success.indexOf(false) === -1) {
      props.onReloadLanguages();
    }
    if (success.indexOf(false) === -1) {
      dispatch(setLanguage(option.key));
    }
  };

  const toggleProfiles = () => {
    if (profilesVisible) {
      dispatch(
        showDialog(
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
              action: () => dispatch(setProfilesVisible(!profilesVisible)),
            },
          ],
        ),
      );
    } else {
      dispatch(setProfilesVisible(!profilesVisible));
    }
  };

  const toggleAutoStart = () => {
    const startOnBoot = !autoStart === true;
    dispatch(setAutoStart(startOnBoot));
    if (!startOnBoot) {
      // We only want to allow the user to start Vortex minimized
      //  if auto start is enabled - easier this way and less chances
      //  for users to forget about this setting and start sending
      //  bug reports.
      dispatch(setStartMinimized(false));
    }
    const preloadApi = getPreloadApi();
    preloadApi.app.setLoginItemSettings({
      openAtLogin: startOnBoot,
      path: process.execPath, // Yes this is currently needed - thanks Electron
      args: startOnBoot ? (startMinimized ? ["--start-minimized"] : []) : [],
    });
  };

  const toggleMinimized = () => {
    const isMinimized = !startMinimized === true;
    dispatch(setStartMinimized(isMinimized));
    const preloadApi = getPreloadApi();
    preloadApi.app.setLoginItemSettings({
      openAtLogin: autoStart,
      path: process.execPath, // Yes this is currently needed - thanks Electron
      args: isMinimized ? ["--start-minimized"] : [],
    });
  };

  const needRestartNotification = needRestart ? (
    <div className="flex items-center gap-x-4 rounded-lg border border-info-weak bg-info-950 p-3">
      <Typography brand="neutral-translucent" className="grow">
        {t("You need to restart Vortex to activate this change")}
      </Typography>

      <Button brand="neutral" onClick={() => relaunch()}>
        {t("Restart now")}
      </Button>
    </div>
  ) : null;

  const numSuppressed = Object.values(suppressedNotifications).filter((val) => val === true).length;

  const startMinimizedToggle = autoStart ? (
    <Toggle checked={startMinimized} onToggle={toggleMinimized}>
      {t("Start Vortex in the background (Minimized)")}
    </Toggle>
  ) : null;

  return (
    <form>
      <FormGroup controlId="languageSelect">
        <div className="flex flex-col items-start gap-y-2">
          <Typography as="span">{t("Language")}</Typography>

          <Picker<string>
            options={languageOptions.map((option) => ({
              label: option.label,
              value: option.id,
            }))}
            placement="left"
            value={selectedLanguageId}
            onChange={selectLanguage}
          />

          <Typography appearance="subdued" typographyType="body-sm">
            {t("When you select a language for the first time you may have to restart Vortex.")}
          </Typography>
        </div>
      </FormGroup>

      <FormGroup controlId="customization">
        <ControlLabel>{t("Customisation")}</ControlLabel>

        <div>
          <div>
            <Toggle
              checked={customTitlebar}
              onToggle={(enabled) => dispatch(setCustomTitlebar(enabled))}
            >
              {t("Custom Window Title Bar")}
            </Toggle>
          </div>

          <div>
            <Toggle
              checked={desktopNotifications !== false}
              onToggle={(enabled) => dispatch(setDesktopNotifications(enabled))}
            >
              {t("Enable Desktop Notifications")}
            </Toggle>
          </div>

          <div>
            <Toggle
              checked={hideTopLevelCategory}
              onToggle={(hide) => dispatch(setHideTopLevelCategory(hide))}
            >
              {t("Hide Top-Level Category")}

              <More id="more-hide-toplevel-category" name={t("Top-Level Categories")}>
                {getText("toplevel-categories", t)}
              </More>
            </Toggle>
          </div>

          <div>
            <Toggle
              checked={relativeTimes}
              onToggle={(enabled) => dispatch(setRelativeTimes(enabled))}
            >
              {t('Use relative times (e.g. "3 months ago")')}
            </Toggle>
          </div>

          <div>
            <Toggle
              checked={alwaysCompactHeaders}
              onToggle={(enabled) => dispatch(setAlwaysCompactHeaders(enabled))}
            >
              {t("Always use compact headers")}

              <Typography appearance="subdued" typographyType="body-sm">
                {t("Keep page headers compact for less motion and more vertical space.")}
              </Typography>
            </Toggle>
          </div>

          <div>
            <Toggle
              checked={reduceMotion}
              onToggle={(enabled) => dispatch(setReduceMotion(enabled))}
            >
              {t("Reduce motion")}

              <Typography appearance="subdued" typographyType="body-sm">
                {t("Minimise non-essential animations and visual effects.")}
              </Typography>
            </Toggle>
          </div>
        </div>

        <div>
          <Toggle checked={foregroundDL} onToggle={(enabled) => dispatch(setForegroundDL(enabled))}>
            {t("Bring Vortex to foreground when starting downloads in browser")}
          </Toggle>
        </div>
      </FormGroup>

      <FormGroup controlId="advanced">
        <ControlLabel>{t("Advanced")}</ControlLabel>

        <div>
          <div>
            <Toggle checked={profilesVisible} onToggle={toggleProfiles}>
              {t("Enable Profile Management")}

              <More id="more-profile-settings" name={t("Profiles")} wikiId="profiles">
                {getTextProfiles("profiles", t)}
              </More>
            </Toggle>
          </div>

          <div>
            <Toggle
              checked={startup.disableGPU !== true}
              onToggle={() => changeStartup("disableGPU", startup.disableGPU !== true)}
            >
              {t("Enable GPU Acceleration")}
            </Toggle>

            {startup.disableGPU === true ? (
              <div className="rounded-lg border border-warning-weak bg-warning-950 p-3">
                <Typography brand="neutral-translucent">
                  {t(
                    "Disabling GPU acceleration will make the Vortex UI significantly less " +
                      "responsive in places.",
                  )}
                </Typography>
              </div>
            ) : null}
          </div>
        </div>
      </FormGroup>

      <FormGroup controlId="automation">
        <ControlLabel>{t("Automation")}</ControlLabel>

        <div>
          <Toggle
            checked={autoDeployment}
            onToggle={(enabled) => dispatch(setAutoDeployment(enabled))}
          >
            {t("Deploy Mods when Enabled")}

            <More id="more-deploy-settings" name={t("Deployment")}>
              {getTextModManagement("deployment", t)}
            </More>
          </Toggle>

          <Toggle checked={autoInstall} onToggle={(enabled) => dispatch(setAutoInstall(enabled))}>
            {t("Install Mods when downloaded")}
          </Toggle>

          <Toggle checked={autoEnable} onToggle={(enabled) => dispatch(setAutoEnable(enabled))}>
            {t("Enable Mods when installed (in current profile)")}
          </Toggle>

          <Toggle checked={autoStart} onToggle={toggleAutoStart}>
            {t("Run Vortex when my computer starts")}
          </Toggle>

          {startMinimizedToggle}
        </div>
      </FormGroup>

      <FormGroup controlId="notifications">
        <ControlLabel>{t("Notifications")}</ControlLabel>

        <div className="flex items-center gap-x-2">
          <Button brand="neutral" onClick={() => dispatch(resetSuppression(null))}>
            {t("Reset suppressed notifications")}
          </Button>

          <Typography appearance="subdued" typographyType="body-sm">
            {t("({{count}} notification is being suppressed)", {
              replace: { count: numSuppressed },
            })}
          </Typography>
        </div>
      </FormGroup>

      {needRestartNotification}
    </form>
  );
}

/** List the subdirectories of a base directory; a missing base yields none. */
async function listSubdirectories(basePath: string): Promise<string[]> {
  try {
    const entries = await readdir(basePath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(basePath, entry.name));
  } catch (err) {
    if (getErrorCode(err) === "ENOENT") return [];
    throw err;
  }
}

async function readLocales(
  extensions: IAvailableExtension[],
  uiLocale: string,
): Promise<ILanguage[]> {
  const bundledLanguages = getVortexPath("locales");
  const userLanguages = path.normalize(path.join(getVortexPath("userData"), "locales"));

  const translationExts = extensions.filter((ext) => ext.type === "translation");

  try {
    const files = (
      await Promise.all([bundledLanguages, userLanguages].map(listSubdirectories))
    ).flat();
    const local = files.map((file) => path.basename(file));

    // the unique languages being supported; there may be multiple extensions
    // providing the same language
    const keys = Array.from(
      new Set([...local, ...translationExts.map((ext) => ext.language)]),
    ).filter((langId): langId is string => langId !== undefined && isValidBcp47(langId));

    const loc = new Set(local);
    // keyed by locale code
    const extsByLanguage = new Map<string, IAvailableExtension[]>();
    for (const ext of translationExts) {
      if (ext.language === undefined) continue;
      extsByLanguage.set(ext.language, [...(extsByLanguage.get(ext.language) ?? []), ext]);
    }

    return keys.map((key) => {
      const ext: Array<Partial<IAvailableExtension>> = loc.has(key)
        ? []
        : (extsByLanguage.get(key) ?? []);
      return { key, displayName: displayBcp47(key, uiLocale), ext };
    });
  } catch (err) {
    log("warn", "failed to read locales", err);
    return [];
  }
}

function SettingsInterface(props: IBaseProps) {
  const [languages, setLanguages] = useState<ILanguage[]>([]);
  const [iteration, setIteration] = useState<number>(0);

  const { lang, exts } = useSelector<IState, { lang: string; exts: IAvailableExtension[] }>(
    (state) => ({
      lang: state.settings.interface.language,
      exts: state.session.extensions.available,
    }),
  );

  const forceReload = useCallback(() => setIteration((i) => i + 1), []);

  useEffect(() => {
    (async () => {
      const langs = await readLocales(exts, lang);
      // ensure the selected language is always an option
      if (langs.length === 0) {
        langs.push({
          key: lang,
          displayName: displayBcp47(lang, lang),
          ext: [],
        });
      }
      setLanguages(langs);
    })();
  }, [lang, exts, iteration]);

  return (
    <SettingsInterfaceForm
      {...props}
      currentLanguage={lang}
      extensions={exts}
      languages={languages}
      onReloadLanguages={forceReload}
    />
  );
}

export default SettingsInterface;
