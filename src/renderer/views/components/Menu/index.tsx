import React, { type FC } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import { setOpenMainPage } from "../../../../actions/session";
import { joinClasses } from "../../../../tailwind/components/next/utils";
import { usePagesContext, useWindowContext } from "../../../contexts";
import { useSpineContext } from "../SpineContext";
import { getIconPath } from "./iconMap";
import { MenuButton } from "./MenuButton";

export const Menu: FC = () => {
  const { t } = useTranslation();
  const { menuIsCollapsed } = useWindowContext();
  const { visiblePages } = useSpineContext();
  const dispatch = useDispatch();

  const { mainPage } = usePagesContext();

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
