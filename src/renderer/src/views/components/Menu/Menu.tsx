import React, { useState, type FC, useLayoutEffect, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import { setOpenMainPage } from "@/actions";
import { usePagesContext, useWindowContext } from "@/contexts";
import { TooltipDelayGroup } from "@/ui/components/tooltip/TooltipDelayGroup";
import { joinClasses } from "@/ui/utils/joinClasses";

import { getIconPath } from "../iconMap";
import { useSpineContext } from "../Spine/SpineContext";
import { DownloadsMenuContent } from "./DownloadsMenuContent";
import { MenuButton } from "./MenuButton";
import { ToolsProvider, useToolsContext } from "./ToolsContext";
import { ToolsSection } from "./ToolsSection";

const toolPadding = {
  1: "pb-32",
  2: "pb-42",
  3: "pb-52",
  4: "pb-62",
  5: "pb-72",
};

const MenuContent: FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation();
  const { menuIsCollapsed } = useWindowContext();
  const { selection, visiblePages } = useSpineContext();
  const dispatch = useDispatch();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { mainPage } = usePagesContext();
  const { visibleTools } = useToolsContext();
  const toolCount = visibleTools.length;
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const onScroll = (event: Event) => setCanScrollUp((event.target as HTMLDivElement).scrollTop > 0);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    const element = scrollRef.current;
    element.addEventListener("scroll", onScroll);
    return () => element.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  useLayoutEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 150);

    return () => clearTimeout(timer);
  }, [menuIsCollapsed]);

  return (
    <TooltipDelayGroup
      as="div"
      className={joinClasses([
        "relative -mt-1 flex shrink-0 flex-col pr-0.5 transition-[width]",
        menuIsCollapsed ? "w-16" : "w-55.5",
      ])}
    >
      {canScrollUp && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-1 h-6 bg-linear-to-b from-surface-base to-transparent" />
      )}

      <div className="mr-1 min-h-0 w-full overflow-y-auto pl-3" ref={scrollRef}>
        <div
          className={joinClasses([
            "flex flex-col gap-y-0.5 pt-1 transition-[width]",
            menuIsCollapsed ? `w-10 ${toolPadding[toolCount]}` : "w-49 pb-34",
          ])}
        >
          {selection.type === "downloads" ? (
            <DownloadsMenuContent />
          ) : (
            visiblePages.map((page) => (
              <MenuButton
                Badge={page.menuBadge}
                iconPath={page.mdi ?? getIconPath(page.icon)}
                isActive={mainPage === page.id}
                key={page.id}
                onClick={() => {
                  if (mainPage === page.id) {
                    page.onReset?.();
                  } else {
                    dispatch(setOpenMainPage(page.id, false));
                  }
                }}
              >
                {t(page.title, { ns: page.namespace })}
              </MenuButton>
            ))
          )}
        </div>

        {/* hack to hide bottom of scrollbar :( */}
        <div className="pointer-events-none absolute right-0 bottom-0 size-3 bg-surface-base" />
      </div>

      <ToolsSection isAnimating={isAnimating} />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-1 h-6 bg-linear-to-t from-surface-base to-transparent" />
    </TooltipDelayGroup>
  );
};

export const Menu: FC<React.PropsWithChildren<unknown>> = () => {
  return (
    <ToolsProvider>
      <MenuContent />
    </ToolsProvider>
  );
};
