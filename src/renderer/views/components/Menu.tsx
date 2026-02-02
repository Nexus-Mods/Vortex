import {
  mdiCog,
  mdiDownload,
  mdiGamepadSquare,
  mdiHelpCircle,
  mdiPuzzle,
  mdiShapeOutline,
  mdiViewDashboard,
} from "@mdi/js";
import React, { type FC, useMemo, type ButtonHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import type { IState } from "../../../types/IState";

import { setOpenMainPage } from "../../../actions/session";
import { Icon } from "../../../tailwind/components/next/icon";
import { Typography } from "../../../tailwind/components/next/typography";
import { joinClasses } from "../../../tailwind/components/next/utils";
import { useWindowContext } from "../../contexts";
import { useMainPages, gameSettingsPage, settingsPage } from "../../hooks";
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

interface MenuButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: string;
  iconPath: string;
  isActive?: boolean;
}

const MenuButton: FC<MenuButtonProps> = ({
  children,
  iconPath,
  isActive,
  ...props
}) => {
  const { menuIsCollapsed } = useWindowContext();

  return (
    <button
      className={joinClasses([
        "flex h-10 items-center gap-x-3 rounded-lg px-3 transition-colors hover:bg-surface-low hover:text-neutral-moderate",
        isActive
          ? "bg-surface-low text-neutral-moderate"
          : "text-neutral-subdued",
      ])}
      {...(menuIsCollapsed ? { title: children } : {})}
      {...props}
    >
      <Icon className="shrink-0" path={iconPath} size="sm" />

      <Typography
        appearance="none"
        as="span"
        className="truncate font-semibold"
        typographyType="body-sm"
      >
        {children}
      </Typography>
    </button>
  );
};

export const Menu: FC = () => {
  const { t } = useTranslation();
  const { menuIsCollapsed } = useWindowContext();
  const { selection } = useSpineContext();
  const dispatch = useDispatch();

  const mainPages = useMainPages();

  const mainPage = useSelector((state: IState) => state.session.base.mainPage);

  // Filter visible pages based on Spine selection
  const visiblePages = useMemo(() => {
    const isHome = selection.type === "home";
    const pages = mainPages.filter((page) => {
      const passesGroupFilter = isHome
        ? page.group !== "per-game"
        : page.group === "per-game" || page.id === "Downloads";
      try {
        return passesGroupFilter && page.visible();
      } catch {
        return false;
      }
    });
    return [...pages, isHome ? settingsPage : gameSettingsPage];
  }, [mainPages, selection]);

  return (
    <div
      className={joinClasses([
        "flex shrink-0 flex-col gap-y-0.5 overflow-hidden px-3 transition-[width]",
        menuIsCollapsed ? "w-16" : "w-56",
      ])}
    >
      {visiblePages.map((page) => (
        <MenuButton
          iconPath={getIconPath(page.icon)}
          isActive={mainPage === page.id}
          key={page.id}
          onClick={() => dispatch(setOpenMainPage(page.id, false))}
        >
          {t(page.title, { ns: page.namespace })}
        </MenuButton>
      ))}
    </div>
  );
};
