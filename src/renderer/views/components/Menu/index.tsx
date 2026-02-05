import React, { useState, type FC, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import { setOpenMainPage } from "../../../../actions/session";
import { joinClasses } from "../../../../tailwind/components/next/utils";
import { usePagesContext, useWindowContext } from "../../../contexts";
import { useSpineContext } from "../SpineContext";
import { getIconPath } from "./iconMap";
import { MenuButton } from "./MenuButton";
import { ToolsSection } from "./ToolsSection";

export const Menu: FC = () => {
  const { t } = useTranslation();
  const { menuIsCollapsed } = useWindowContext();
  const { visiblePages } = useSpineContext();
  const dispatch = useDispatch();

  const { mainPage } = usePagesContext();
  const [isAnimating, setIsAnimating] = useState(false);

  useLayoutEffect(() => {
    // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 150);

    return () => clearTimeout(timer);
  }, [menuIsCollapsed]);

  return (
    <div
      className={joinClasses([
        "flex shrink-0 flex-col items-center justify-between gap-y-6 overflow-hidden transition-[width]",
        menuIsCollapsed ? "w-16" : "w-56",
      ])}
    >
      <div
        className={joinClasses([
          "flex flex-col gap-y-0.5 transition-[width]",
          menuIsCollapsed ? "w-10" : "w-50",
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

      <ToolsSection isAnimating={isAnimating} />
    </div>
  );
};
