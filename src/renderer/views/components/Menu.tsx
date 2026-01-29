import {
  mdiCog,
  mdiDownload,
  mdiGamepadSquare,
  mdiHelpCircle,
  mdiPuzzle,
  mdiShapeOutline,
  mdiViewDashboard,
} from "@mdi/js";
import React, { type ButtonHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import type { IMainPage } from "../../../types/IMainPage";
import type { IState } from "../../../types/IState";

import { setOpenMainPage } from "../../../actions/session";
import { Icon } from "../../../tailwind/components/next/icon";
import { Typography } from "../../../tailwind/components/next/typography";
import { joinClasses } from "../../../tailwind/components/next/utils";
import { useWindowContext } from "../../../util/WindowContext";
import { settingsPage } from "../layout/usePageRendering";

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
  const { isMenuOpen } = useWindowContext();

  return (
    <button
      className={joinClasses([
        "flex h-10 items-center gap-x-3 rounded-lg transition-colors hover:bg-surface-low hover:text-neutral-moderate",
        isActive
          ? "bg-surface-low text-neutral-moderate"
          : "text-neutral-subdued",
        isMenuOpen ? "px-3" : "w-10 justify-center",
      ])}
      {...props}
    >
      <Icon className="shrink-0" path={iconPath} size="sm" />

      {isMenuOpen && (
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
  const { isMenuOpen } = useWindowContext();
  const dispatch = useDispatch();

  const mainPage = useSelector((state: IState) => state.session.base.mainPage);

  const handleClickPage = React.useCallback(
    (pageId: string) => {
      dispatch(setOpenMainPage(pageId, false));
    },
    [dispatch],
  );

  // Filter visible pages - exclude per-game pages for now, include settings
  const visiblePages = React.useMemo(() => {
    const pages = objects.filter((page) => {
      // Skip per-game pages (they'll be shown when a game is selected in spine)
      if (page.group === "per-game") {
        return false;
      }
      try {
        return page.visible();
      } catch {
        return false;
      }
    });
    return [...pages, settingsPage];
  }, [objects]);

  return (
    <div
      className={joinClasses([
        "flex shrink-0 flex-col gap-y-0.5 px-3",
        isMenuOpen ? "w-56" : "w-16",
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
