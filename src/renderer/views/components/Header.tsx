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
} from "@mdi/js";
import React, {
  type ButtonHTMLAttributes,
  type CSSProperties,
  useCallback,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IState } from "../../../types/IState";

import { Icon } from "../../../tailwind/components/next/icon";
import { Typography } from "../../../tailwind/components/next/typography";
import { joinClasses } from "../../../tailwind/components/next/utils";
import { useWindowContext } from "../../../util/WindowContext";
import {
  close,
  minimize,
  toggleMaximize,
  useIsMaximized,
} from "../../utils/windowManipulation";
import { useSpineContext } from "./SpineContext";

const IconButton = ({
  className,
  iconPath,
  imageSrc,
  isAvatar,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string;
  iconPath: string;
  imageSrc?: string;
  isAvatar?: boolean;
}) => {
  const hasImage = !!imageSrc;

  return (
    <button
      className={joinClasses([
        "flex size-7 items-center justify-center",
        hasImage || isAvatar
          ? "hover-overlay relative overflow-hidden rounded-full"
          : "rounded-sm text-neutral-moderate transition-colors hover:bg-surface-translucent-mid hover:text-neutral-strong",
        className,
      ])}
      {...props}
    >
      {hasImage ? (
        <img alt="" className="size-6 rounded-full" src={imageSrc} />
      ) : (
        <Icon
          className={isAvatar ? "size-6" : "size-5"}
          path={iconPath}
          size="none"
        />
      )}
    </button>
  );
};

const WindowControl = ({
  className,
  iconPath,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string;
  iconPath: string;
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

export const Header = () => {
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

          <IconButton
            iconPath={mdiAccountCircle}
            imageSrc="https://avatars.nexusmods.com/138908768/100"
            isAvatar={true}
            title="Profile"
          />
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
