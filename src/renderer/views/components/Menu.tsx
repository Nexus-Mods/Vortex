import {
  mdiCog,
  mdiDownload,
  mdiGamepadSquare,
  mdiHelpCircle,
  mdiPuzzle,
  mdiShapeOutline,
  mdiViewDashboard,
} from "@mdi/js";
import React, { useCallback, useMemo, type ButtonHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import type { IMainPage } from "../../../types/IMainPage";
import type { IState } from "../../../types/IState";

import { setOpenMainPage } from "../../../actions/session";
import { Icon } from "../../../tailwind/components/next/icon";
import { Typography } from "../../../tailwind/components/next/typography";
import { joinClasses } from "../../../tailwind/components/next/utils";
import { useWindowContext } from "../../../util/WindowContext";
import { settingsPage } from "../../utils/usePageRendering";
import { useSpineContext } from "./SpineContext";

// Map legacy icon names to MDI paths
const iconMap: Record<string, string> = {
  dashboard: mdiViewDashboard,
  mods: mdiPuzzle,
  settings: mdiCog,
  download: mdiDownload,
  game: mdiGamepadSquare,
  support: mdiHelpCircle,
};

const getIconPath = (iconName: string): string => {
  return iconMap[iconName] ?? mdiShapeOutline;
};

const MenuButton = ({
  children,
  iconPath,
  isActive,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  iconPath: string;
  isActive?: boolean;
}) => {
  const { menuIsCollapsed } = useWindowContext();

  return (
    <button
      className={joinClasses([
        "flex h-10 items-center gap-x-3 rounded-lg transition-colors hover:bg-surface-low hover:text-neutral-moderate",
        isActive
          ? "bg-surface-low text-neutral-moderate"
          : "text-neutral-subdued",
        menuIsCollapsed ? "w-10 justify-center" : "px-3",
      ])}
      {...props}
    >
      <Icon className="shrink-0" path={iconPath} size="sm" />

      {!menuIsCollapsed && (
        <Typography
          appearance="none"
          as="span"
          className="truncate font-semibold"
          typographyType="body-sm"
        >
          {children}
        </Typography>
      )}
    </button>
  );
};

export interface IMenuProps {
  objects: IMainPage[];
}

export const Menu = ({ objects }: IMenuProps) => {
  const { t } = useTranslation();
  const { menuIsCollapsed } = useWindowContext();
  const { selection } = useSpineContext();
  const dispatch = useDispatch();

  const mainPage = useSelector((state: IState) => state.session.base.mainPage);

  const handleClickPage = useCallback(
    (pageId: string) => {
      dispatch(setOpenMainPage(pageId, false));
    },
    [dispatch],
  );

  // Filter visible pages based on Spine selection
  const visiblePages = useMemo(() => {
    const pages = objects.filter((page) => {
      // When Home is selected, show global pages (not per-game)
      // When a game is selected, show per-game pages + Downloads
      if (selection.type === "home") {
        if (page.group === "per-game") {
          return false;
        }
      } else {
        // Game selected - show per-game pages and Downloads
        if (page.group !== "per-game" && page.id !== "Downloads") {
          return false;
        }
      }
      try {
        return page.visible();
      } catch {
        return false;
      }
    });
    // Always add settings page at the end
    return [...pages, settingsPage];
  }, [objects, selection]);

  return (
    <div
      className={joinClasses([
        "flex shrink-0 flex-col gap-y-0.5 px-3",
        menuIsCollapsed ? "w-16" : "w-56",
      ])}
    >
      {visiblePages.map((page) => (
        <MenuButton
          iconPath={getIconPath(page.icon)}
          isActive={mainPage === page.id}
          key={page.id}
          onClick={() => handleClickPage(page.id)}
        >
          {t(page.title, { ns: page.namespace })}
        </MenuButton>
      ))}
    </div>
  );
};
