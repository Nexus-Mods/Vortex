import { Menu } from "@headlessui/react";
import {
  mdiMenuOpen,
  mdiMenuClose,
  mdiWindowMinimize,
  mdiWindowMaximize,
  mdiWindowClose,
  mdiBell,
  mdiHelpCircleOutline,
  mdiWindowRestore,
  mdiAccountCircle,
  mdiRefresh,
  mdiMessageReplyText,
  mdiLogout,
} from "@mdi/js";
import React, { type FC } from "react";
import {
  type ButtonHTMLAttributes,
  type CSSProperties,
  useCallback,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IState } from "../../../types/IState";

import {
  Dropdown,
  DropdownDivider,
  DropdownItem,
  DropdownItems,
} from "../../../tailwind/components/dropdown";
import { Icon } from "../../../tailwind/components/next/icon";
import { Typography } from "../../../tailwind/components/next/typography";
import { joinClasses } from "../../../tailwind/components/next/utils";
import { useWindowContext } from "../../contexts";
import { close, minimize, toggleMaximize, useIsMaximized } from "../../hooks";
import { useSpineContext } from "./SpineContext";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  iconPath: string;
}

const IconButton: FC<IconButtonProps> = ({ className, iconPath, ...props }) => (
  <button
    className={joinClasses([
      "flex size-7 items-center justify-center rounded-sm text-neutral-moderate transition-colors hover:bg-surface-translucent-mid hover:text-neutral-strong",
      className,
    ])}
    {...props}
  >
    <Icon className="size-5" path={iconPath} size="none" />
  </button>
);

interface WindowControlProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  iconPath: string;
}

const WindowControl: FC<WindowControlProps> = ({
  className,
  iconPath,
  ...props
}) => (
  <button
    className={joinClasses([
      "flex size-11 items-center justify-center text-neutral-subdued transition-colors hover:text-neutral-strong",
      className,
    ])}
    {...props}
  >
    <Icon path={iconPath} size="sm" />
  </button>
);

export const Header: FC = () => {
  const { menuIsCollapsed, setMenuIsCollapsed } = useWindowContext();
  const { t } = useTranslation();
  const { selection } = useSpineContext();
  const knownGames = useSelector(
    (state: IState) => state.session.gameMode.known,
  );

  const isMaximized = useIsMaximized();

  const title = useMemo(() => {
    if (selection.type === "home") {
      return t("Home");
    }
    const game = knownGames.find((g) => g.id === selection.gameId);
    return game?.name ?? t("Home");
  }, [selection, knownGames, t]);

  const handleToggleMenu = useCallback(() => {
    setMenuIsCollapsed((prev) => !prev);
  }, [setMenuIsCollapsed]);

  return (
    <div
      className="flex h-11 items-center justify-between pl-4"
      style={{ WebkitAppRegion: "drag" } as CSSProperties}
    >
      <div
        className="flex items-center gap-x-1"
        style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
      >
        <IconButton
          iconPath={menuIsCollapsed ? mdiMenuClose : mdiMenuOpen}
          title={menuIsCollapsed ? "Open menu" : "Collapse menu"}
          onClick={handleToggleMenu}
        />

        <Typography className="truncate leading-5 font-semibold">
          {title}
        </Typography>
      </div>

      <div
        className="flex items-center gap-x-4"
        style={{ WebkitAppRegion: "no-drag" } as CSSProperties}
      >
        {/* todo show if user is premium */}
        <Typography
          appearance="moderate"
          className="leading-5"
          typographyType="title-sm"
        >
          Premium
        </Typography>

        <div className="flex gap-x-2">
          <IconButton iconPath={mdiBell} title="Notifications" />

          <IconButton iconPath={mdiHelpCircleOutline} title="Help" />

          <Dropdown>
            <Menu.Button
              className="hover-overlay relative flex size-7 items-center justify-center overflow-hidden rounded-full"
              title="Profile"
            >
              {/* todo if profile image */}
              <img
                alt=""
                className="size-6 rounded-full"
                src="https://avatars.nexusmods.com/138908768/100"
              />

              {/* todo if no profile image */}
              {/*<Icon*/}
              {/*  className="size-6"*/}
              {/*  path={mdiAccountCircle}*/}
              {/*  size="none"*/}
              {/*/>*/}
            </Menu.Button>

            <DropdownItems>
              <DropdownItem leftIconPath={mdiAccountCircle}>
                View profile on web
              </DropdownItem>

              <DropdownDivider />

              <DropdownItem leftIconPath={mdiRefresh}>
                Refresh user info
              </DropdownItem>

              <DropdownItem leftIconPath={mdiMessageReplyText}>
                Send feedback
              </DropdownItem>

              <DropdownDivider />

              <DropdownItem leftIconPath={mdiLogout}>Logout</DropdownItem>
            </DropdownItems>
          </Dropdown>
        </div>

        <div className="h-6 w-px bg-stroke-weak" />

        <div className="flex">
          <WindowControl
            className="hover:bg-surface-mid"
            iconPath={mdiWindowMinimize}
            title="Minimize"
            onClick={minimize}
          />

          <WindowControl
            className="hover:bg-surface-mid"
            iconPath={isMaximized ? mdiWindowRestore : mdiWindowMaximize}
            title={isMaximized ? "Restore" : "Maximize"}
            onClick={toggleMaximize}
          />

          <WindowControl
            className="hover:bg-danger-subdued"
            iconPath={mdiWindowClose}
            title="Close"
            onClick={close}
          />
        </div>
      </div>
    </div>
  );
};
