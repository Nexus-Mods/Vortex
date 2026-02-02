import React, { type FC, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import type { IState } from "../../../../types/IState";

import { setOpenMainPage } from "../../../../actions/session";
import { joinClasses } from "../../../../tailwind/components/next/utils";
import { useWindowContext } from "../../../contexts";
import { gameSettingsPage, settingsPage, useMainPages } from "../../../hooks";
import { useSpineContext } from "../SpineContext";
import { getIconPath } from "./iconMap";
import { MenuButton } from "./MenuButton";

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
