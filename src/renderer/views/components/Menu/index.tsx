import React, { useState, type FC, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import { setOpenMainPage } from "../../../../actions";
import { joinClasses } from "../../../../tailwind/components/next/utils";
import { usePagesContext, useWindowContext } from "../../../contexts";
import { getIconPath } from "../iconMap";
import { useSpineContext } from "../SpineContext";
import { MenuButton } from "./MenuButton";
import { ToolsSection } from "./ToolsSection";

const toolPadding = {
  1: "pb-28",
  2: "pb-37.5",
  3: "pb-47",
  4: "pb-56.5",
  5: "pb-66",
};

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
        "relative flex shrink-0 flex-col pr-0.5 transition-[width]",
        menuIsCollapsed ? "w-16" : "w-56",
      ])}
    >
      <div className="mr-1 min-h-0 w-full overflow-y-auto pl-3">
        <div
          className={joinClasses([
            "flex flex-col gap-y-0.5 transition-[width]",
            // todo pass tool count to adjust scroll padding when collapsed
            menuIsCollapsed ? `w-10 ${toolPadding[1]}` : "w-50 pb-28",
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

        {/* hack to hide bottom of scrollbar :( */}
        <div className="pointer-events-none absolute right-0 bottom-0 size-3 bg-surface-base" />
      </div>

      <ToolsSection isAnimating={isAnimating} />
    </div>
  );
};
