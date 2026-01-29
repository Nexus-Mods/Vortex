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
import React, { type ButtonHTMLAttributes } from "react";
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
} from "../../../util/windowManipulation";
import { useSpineContext } from "./SpineContext";

const IconButton = ({
  className,
  iconPath,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string;
  iconPath: string;
}) => (
  <button
    className={joinClasses([
      "flex size-7 items-center justify-center rounded-sm text-neutral-moderate transition-colors hover:bg-surface-translucent-mid hover:text-neutral-strong",
      className,
    ])}
    {...props}
  >
    <Icon path={iconPath} />
  </button>
);

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

  const title = React.useMemo(() => {
    if (selection.type === "home") {
      return t("Home");
    }
    const game = knownGames.find((g) => g.id === selection.gameId);
    return game?.name ?? t("Home");
  }, [selection, knownGames, t]);

  const handleToggleMenu = React.useCallback(() => {
    setMenuIsCollapsed((prev) => !prev);
  }, [setMenuIsCollapsed]);

  return (
    <div
      className="flex h-11 items-center justify-between pl-5"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div
        className="flex items-center gap-x-1"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
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
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <div className="flex gap-x-3">
          <IconButton iconPath={mdiBell} title="Notifications" />

          <IconButton iconPath={mdiHelpCircleOutline} title="Help" />

          <IconButton iconPath={mdiAccountCircle} title="Profile" />
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
