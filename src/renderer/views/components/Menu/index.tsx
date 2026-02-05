import { mdiPlay } from "@mdi/js";
import React, { useRef, useState, type FC, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import { setOpenMainPage } from "../../../../actions/session";
import { Button } from "../../../../tailwind/components/next/button";
import { joinClasses } from "../../../../tailwind/components/next/utils";
import { usePagesContext, useWindowContext } from "../../../contexts";
import { useSpineContext } from "../SpineContext";
import { getIconPath } from "./iconMap";
import { MenuButton } from "./MenuButton";
import { ToolButton } from "./ToolButton";

export const Menu: FC = () => {
  const { t } = useTranslation();
  const { menuIsCollapsed } = useWindowContext();
  const { visiblePages } = useSpineContext();
  const dispatch = useDispatch();

  const { mainPage } = usePagesContext();
  const [isAnimating, setIsAnimating] = useState(false);

  useLayoutEffect(() => {
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

      <div
        className={joinClasses([
          "flex flex-col items-center gap-y-1.5 rounded-md bg-surface-low py-1.5 transition-[width,padding]",
          menuIsCollapsed ? "w-10 px-0.5" : "w-50 px-1.5",
        ])}
      >
        <div
          className={joinClasses([
            "flex flex-wrap items-center gap-1.5 transition-[translate,opacity]",
            menuIsCollapsed ? "w-8" : "w-46",
            isAnimating ? "translate-y-6 opacity-0 duration-0" : "duration-200",
          ])}
        >
          {[1, 2, 3, 4, 5].map((index) => (
            <ToolButton
              imageSrc={
                index % 2
                  ? "https://images.nexusmods.com/images/games/v2/3333/thumbnail.jpg"
                  : "https://images.nexusmods.com/images/games/v2/1151/thumbnail.jpg"
              }
              key={index}
              title={`Tool ${index}`}
            />
          ))}
        </div>

        <Button
          buttonType="secondary"
          className="w-full transition-all"
          filled="strong"
          leftIconPath={mdiPlay}
        >
          {!menuIsCollapsed ? "Play" : undefined}
        </Button>
      </div>
    </div>
  );
};
