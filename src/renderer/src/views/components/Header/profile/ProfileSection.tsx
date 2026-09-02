import { mdiAccountCircle, mdiLogout, mdiRefresh } from "@mdi/js";
import React, { type FC } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { useExtensionContext } from "@/ExtensionProvider";
import {
  clearOAuthCredentials,
  setUserAPIKey,
} from "@/extensions/nexus_integration/actions/account";
import { NEXUS_BASE_URL } from "@/extensions/nexus_integration/constants";
import { scheduleMembershipRefresh } from "@/extensions/nexus_integration/membership";
import { Icon } from "@/ui/components/icon/Icon";
import { Image } from "@/ui/components/image/Image";
import { Popover } from "@/ui/components/popover/Popover";
import { PopoverButton } from "@/ui/components/popover/PopoverButton";
import { PopoverMenu } from "@/ui/components/popover/PopoverMenu";
import type { IMenuAction } from "@/ui/components/popover/PopoverMenuItem";
import { PopoverPanel } from "@/ui/components/popover/PopoverPanel";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";

import opn from "../../../../util/opn";
import {
  isLoggedIn as isLoggedInSelector,
  userInfo as userInfoSelector,
} from "../../../../util/selectors";
import { HelpMenu } from "../help/HelpMenu";
import { useHelpAction } from "../help/useHelpMenu.hook";

export const ProfileSection: FC<React.PropsWithChildren<unknown>> = () => {
  const dispatch = useDispatch();
  const extensions = useExtensionContext();
  const api = extensions.getApi();
  const { t } = useTranslation();

  const loggedIn = useSelector(isLoggedInSelector);
  const userInfo = useSelector(userInfoSelector);

  const helpAction = useHelpAction();

  // Signed out there is no account to open, so the slot carries the help options on
  // their own — the login call to action lives in the premium slot instead.
  if (!loggedIn || !userInfo) {
    return <HelpMenu />;
  }

  const label = userInfo.name ?? t("Account");

  const sections: IMenuAction[][] = [
    [
      {
        iconPath: mdiAccountCircle,
        label: t("View profile on web"),
        onClick: () => {
          opn(`${NEXUS_BASE_URL}/users/${userInfo.userId}`).catch(() => {});
        },
      },
    ],
    [
      {
        iconPath: mdiRefresh,
        label: t("Refresh user info"),
        onClick: () => scheduleMembershipRefresh(api),
      },
      helpAction,
    ],
    [
      {
        iconPath: mdiLogout,
        label: t("Logout"),
        onClick: () => {
          dispatch(setUserAPIKey(undefined));
          dispatch(clearOAuthCredentials(null));
        },
      },
    ],
  ];

  return (
    <Popover>
      {({ open }) => (
        <>
          <Tooltip content={label} disabled={open} placement="bottom">
            <PopoverButton
              appearance="weak"
              aria-haspopup="menu"
              aria-label={label}
              brand="neutral"
              data-testid="profile-menu-trigger"
              leftIcon={
                userInfo.profileUrl ? (
                  <Image
                    alt={userInfo.name ?? ""}
                    className="size-5 rounded-full"
                    fit="cover"
                    src={userInfo.profileUrl}
                  />
                ) : (
                  <Icon path={mdiAccountCircle} />
                )
              }
            />
          </Tooltip>

          <PopoverPanel className="nxm-popover-panel-dropdown">
            {({ close }) => <PopoverMenu actions={sections} label={label} onSelect={close} />}
          </PopoverPanel>
        </>
      )}
    </Popover>
  );
};
