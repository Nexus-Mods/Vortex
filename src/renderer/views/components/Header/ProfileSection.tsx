import { Menu } from "@headlessui/react";
import {
  mdiAccountCircle,
  mdiLogout,
  mdiMessageReplyText,
  mdiRefresh,
} from "@mdi/js";
import React, { type FC, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import type { IState } from "../../../../types/IState";

import { setDialogVisible } from "../../../../actions/session";
import {
  clearOAuthCredentials,
  setUserAPIKey,
} from "../../../../extensions/nexus_integration/actions/account";
import { NEXUS_BASE_URL } from "../../../../extensions/nexus_integration/constants";
import {
  Dropdown,
  DropdownDivider,
  DropdownItem,
  DropdownItems,
} from "../../../../tailwind/components/dropdown";
import { Icon } from "../../../../tailwind/components/next/icon";
import { useExtensionContext } from "../../../../util/ExtensionProvider";
import {
  hasNexusConfidential,
  hasNexusPersistent,
} from "../../../../util/nexusState";
import opn from "../../../../util/opn";
import { truthy } from "../../../../util/util";

export const ProfileSection: FC = () => {
  const dispatch = useDispatch();
  const extensions = useExtensionContext();
  const api = extensions.getApi();
  const { t } = useTranslation();

  const loggedIn = useSelector((state: IState) => {
    if (!hasNexusConfidential(state.confidential)) {
      return false;
    }
    const { nexus } = state.confidential.account;
    return truthy(nexus?.APIKey) || truthy(nexus?.OAuthCredentials);
  });

  const userInfo = useSelector((state: IState) => {
    if (!hasNexusPersistent(state.persistent)) {
      return undefined;
    }
    return state.persistent.nexus.userInfo;
  });

  const handleRefreshUserInfo = useCallback(() => {
    api.events.emit("refresh-user-info");
  }, [api]);

  const handleLogout = useCallback(() => {
    dispatch(setUserAPIKey(undefined));
    dispatch(clearOAuthCredentials(null));
  }, [dispatch]);

  const handleProfileClick = useCallback(() => {
    if (loggedIn && userInfo?.userId) {
      opn(`${NEXUS_BASE_URL}/users/${userInfo.userId}`).catch(() => undefined);
    } else {
      dispatch(setDialogVisible("login-dialog"));
      api.events.emit("request-nexus-login", (err: Error) => {
        if (err !== null) {
          api.showErrorNotification?.("Login Failed", err);
        }
      });
    }
  }, [api, dispatch, loggedIn, userInfo]);

  const handleSendFeedback = useCallback(() => {
    opn("https://forms.gle/YF9ED2Xe4ef9jKf99").catch(() => undefined);
  }, []);

  if (!loggedIn) {
    return (
      <button
        className="hover-overlay relative flex size-7 items-center justify-center overflow-hidden rounded-full"
        title={t("Log in")}
        onClick={handleProfileClick}
      >
        <Icon
          className="size-6 text-neutral-moderate"
          path={mdiAccountCircle}
          size="none"
        />
      </button>
    );
  }

  return (
    <Dropdown>
      <Menu.Button
        className="hover-overlay relative flex size-7 items-center justify-center overflow-hidden rounded-full"
        title={userInfo?.name ?? t("Profile")}
      >
        {userInfo?.profileUrl ? (
          <img
            alt={userInfo.name}
            className="size-6 rounded-full"
            src={userInfo.profileUrl}
          />
        ) : (
          <Icon
            className="size-6 text-neutral-moderate"
            path={mdiAccountCircle}
            size="none"
          />
        )}
      </Menu.Button>

      <DropdownItems>
        <DropdownItem
          leftIconPath={mdiAccountCircle}
          onClick={handleProfileClick}
        >
          {t("View profile on web")}
        </DropdownItem>

        <DropdownDivider />

        <DropdownItem leftIconPath={mdiRefresh} onClick={handleRefreshUserInfo}>
          {t("Refresh user info")}
        </DropdownItem>

        <DropdownItem
          leftIconPath={mdiMessageReplyText}
          onClick={handleSendFeedback}
        >
          {t("Send feedback")}
        </DropdownItem>

        <DropdownDivider />

        <DropdownItem leftIconPath={mdiLogout} onClick={handleLogout}>
          {t("Logout")}
        </DropdownItem>
      </DropdownItems>
    </Dropdown>
  );
};
