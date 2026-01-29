import * as React from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import * as semver from "semver";

import type { IActionDefinition } from "../../../types/IActionDefinition";
import type { IState } from "../../../types/IState";

import { useSwitchingProfile } from "../../../util/useSwitchingProfile";
import Banner from "../../controls/Banner";
import DynDiv from "../../controls/DynDiv";
import FlexLayout from "../../controls/FlexLayout";
import Icon from "../../controls/Icon";
import IconBar from "../../controls/IconBar";
import { NotificationButton } from "../NotificationButton";
import { QuickLauncher } from "../QuickLauncher";

// Looks like we never really used them?
// I haven't found any way to inject here anything
const applicationButtons: IActionDefinition[] = [];
const globalButtons: IActionDefinition[] = [];

export const Toolbar = (): JSX.Element | null => {
  const { t } = useTranslation();
  const customTitlebar = useSelector(
    (state: IState) => state.settings.window.customTitlebar,
  );
  const version = useSelector((state: IState) => state.app.appVersion);
  const switchingProfile = useSwitchingProfile();

  const parsedVersion = semver.parse(version);
  const prerelease = parsedVersion?.prerelease[0] ?? "stable";
  const updateChannelClassName =
    "toolbar-version-container toolbar-version-" + prerelease;

  const className = customTitlebar ? "toolbar-app-region" : "toolbar-default";

  if (switchingProfile) {
    return <div className={className} />;
  }

  return (
    <FlexLayout.Fixed className={className} id="main-toolbar">
      <QuickLauncher />

      <Banner group="main-toolbar" />

      <DynDiv group="main-toolbar" />

      <div className="flex-fill" />

      <div className="main-toolbar-right">
        <div className="toolbar-version">
          {process.env.IS_PREVIEW_BUILD === "true" ? (
            <div className="toolbar-version-container toolbar-version-staging">
              <Icon name="conflict" />

              <div className="toolbar-version-text">Staging</div>
            </div>
          ) : null}

          {process.env.NODE_ENV === "development" ? (
            <div className="toolbar-version-container toolbar-version-dev">
              <Icon name="mods" />

              <div className="toolbar-version-text">Development</div>
            </div>
          ) : null}

          <div className={updateChannelClassName}>
            {prerelease !== "stable" ? <Icon name="highlight-lab" /> : null}

            <div className="toolbar-version-text">{version}</div>
          </div>
        </div>

        <div className="application-icons-group">
          <IconBar
            className="application-icons"
            group="application-icons"
            staticElements={applicationButtons}
            t={t}
          />

          <NotificationButton
            hide={switchingProfile}
            id="notification-button"
          />

          <IconBar
            className="global-icons"
            collapse={true}
            group="global-icons"
            id="global-icons"
            orientation="vertical"
            staticElements={globalButtons}
            t={t}
          />
        </div>
      </div>
    </FlexLayout.Fixed>
  );
};
