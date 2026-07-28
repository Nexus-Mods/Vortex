import { MenuButton } from "@headlessui/react";
import { mdiAccountCircle, mdiLogout, mdiMessageReplyText, mdiRefresh } from "@mdi/js";
import React, { type ButtonHTMLAttributes, forwardRef, type FC, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import { setDialogVisible } from "@/actions";
import { scheduleMembershipRefresh } from "@/extensions/nexus_integration/membership";
import { useExtensionContext } from "@/ExtensionProvider";
import {
  clearOAuthCredentials,
  setUserAPIKey,
} from "@/extensions/nexus_integration/actions/account";
import { NEXUS_BASE_URL } from "@/extensions/nexus_integration/constants";
import { Button } from "@/ui/components/button/Button";
import { Dropdown } from "@/ui/components/dropdown/Dropdown";
import { DropdownDivider } from "@/ui/components/dropdown/DropdownDivider";
import { DropdownItem } from "@/ui/components/dropdown/DropdownItem";
import { DropdownItems } from "@/ui/components/dropdown/DropdownItems";
import { Icon } from "@/ui/components/icon/Icon";
import { Image } from "@/ui/components/image/Image";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";

import { UserCanceled } from "../../../util/CustomErrors";
import opn from "../../../util/opn";
import {
  isLoggedIn as isLoggedInSelector,
  userInfo as userInfoSelector,
} from "../../../util/selectors";

/**
 * The avatar, as the `as` target of a `MenuButton`. The avatar is passed as
 * `leftIcon` rather than `leftIconPath` so the same slot holds either the user's
 * picture or the fallback glyph, and `Button` styles both identically.
 */
const ActionButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
    imageSrc?: string;
    username?: string;
  }
>(({ "aria-label": ariaLabel, "aria-expanded": isOpen, imageSrc, username, ...props }, ref) => (
  <Tooltip content={ariaLabel} disabled={!!isOpen} placement="bottom">
    <Button
      appearance="weak"
      aria-expanded={isOpen}
      aria-label={ariaLabel}
      brand="neutral"
      leftIcon={
        imageSrc ? (
          <Image alt={username ?? ""} className="size-5 rounded-full" fit="cover" src={imageSrc} />
        ) : (
          <Icon path={mdiAccountCircle} />
        )
      }
      {...props}
      ref={ref}
    />
  </Tooltip>
));

ActionButton.displayName = "ProfileActionButton";

export const ProfileSection: FC<React.PropsWithChildren<unknown>> = () => {
  const dispatch = useDispatch();
  const extensions = useExtensionContext();
  const api = extensions.getApi();
  const { t } = useTranslation();

  const loggedIn = useSelector(isLoggedInSelector);

  const userInfo = useSelector(userInfoSelector);

  const handleRefreshUserInfo = useCallback(() => {
    scheduleMembershipRefresh(api);
  }, [api]);

  const handleLogout = useCallback(() => {
    dispatch(setUserAPIKey(undefined));
    dispatch(clearOAuthCredentials(null));
  }, [dispatch]);

  const handleProfileClick = useCallback(() => {
    if (loggedIn && userInfo?.userId !== undefined) {
      opn(`${NEXUS_BASE_URL}/users/${userInfo.userId}`).catch(() => {});
    } else {
      dispatch(setDialogVisible("login-dialog"));
      api.events.emit("request-nexus-login", (err: Error) => {
        if (err != null && !(err instanceof UserCanceled)) {
          api.showErrorNotification?.("Login Failed", err, {
            id: "failed-get-nexus-key",
            allowReport: false,
          });
        }
      });
    }
  }, [api, dispatch, loggedIn, userInfo]);

  const handleSendFeedback = useCallback(() => {
    opn("https://forms.gle/YF9ED2Xe4ef9jKf99").catch(() => {});
  }, []);

  if (!loggedIn || !userInfo) {
    return <ActionButton aria-label={t("Log in")} onClick={handleProfileClick} />;
  }

  return (
    <Dropdown>
      <MenuButton
        aria-label={userInfo.name ?? t("Profile")}
        as={ActionButton}
        imageSrc={userInfo.profileUrl}
        username={userInfo.name}
      />

      <DropdownItems>
        <DropdownItem leftIconPath={mdiAccountCircle} onClick={handleProfileClick}>
          {t("View profile on web")}
        </DropdownItem>

        <DropdownDivider />

        <DropdownItem leftIconPath={mdiRefresh} onClick={handleRefreshUserInfo}>
          {t("Refresh user info")}
        </DropdownItem>

        <DropdownItem leftIconPath={mdiMessageReplyText} onClick={handleSendFeedback}>
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
