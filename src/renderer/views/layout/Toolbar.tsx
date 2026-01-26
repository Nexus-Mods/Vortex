import Banner from "../../controls/Banner";
import DynDiv from "../../controls/DynDiv";
import FlexLayout from "../../controls/FlexLayout";
import Icon from "../../controls/Icon";
import IconBar from "../../controls/IconBar";
import type { IActionDefinition } from "../../../types/IActionDefinition";
import type { IState } from "../../../types/IState";
import { truthy } from "../../../util/util";
import NotificationButton from "../NotificationButton";
import QuickLauncher from "../QuickLauncher";
import * as semver from "semver";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

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
  const activeProfileId = useSelector(
    (state: IState) => state.settings.profiles.activeProfileId,
  );
  const nextProfileId = useSelector(
    (state: IState) => state.settings.profiles.nextProfileId,
  );
  const switchingProfile =
    activeProfileId !== nextProfileId && truthy(nextProfileId);

  const parsedVersion = semver.parse(version);
  const prerelease = parsedVersion?.prerelease[0] ?? "stable";
  const updateChannelClassName =
    "toolbar-version-container toolbar-version-" + prerelease;

  const className = customTitlebar ? "toolbar-app-region" : "toolbar-default";

  if (switchingProfile) {
    return <div className={className} />;
  }

  return (
    <FlexLayout.Fixed id="main-toolbar" className={className}>
      <QuickLauncher />
      <Banner group="main-toolbar" />
      <DynDiv group="main-toolbar" />
      <div className="flex-fill" />
      <div className="main-toolbar-right">
        <div className="toolbar-version">
          {process.env.IS_PREVIEW_BUILD === "true" ? (
            <div className="toolbar-version-container toolbar-version-staging">
              <Icon name="conflict"></Icon>
              <div className="toolbar-version-text">Staging</div>
            </div>
          ) : null}

          {process.env.NODE_ENV === "development" ? (
            <div className="toolbar-version-container toolbar-version-dev">
              <Icon name="mods"></Icon>
              <div className="toolbar-version-text">Development</div>
            </div>
          ) : null}

          <div className={updateChannelClassName}>
            {prerelease !== "stable" ? (
              <Icon name="highlight-lab"></Icon>
            ) : null}
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
            id="notification-button"
            hide={switchingProfile}
          />
          <IconBar
            id="global-icons"
            className="global-icons"
            group="global-icons"
            staticElements={globalButtons}
            orientation="vertical"
            collapse
            t={t}
          />
        </div>
      </div>
    </FlexLayout.Fixed>
  );
};
