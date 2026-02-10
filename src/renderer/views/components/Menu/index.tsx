import React, {
  useState,
  type FC,
  useLayoutEffect,
  useRef,
  useEffect,
} from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import { setOpenMainPage } from "../../../../actions";
import { joinClasses } from "../../../../tailwind/components/next/utils";
import { usePagesContext, useWindowContext } from "../../../contexts";
import { getIconPath } from "../iconMap";
import { useSpineContext } from "../Spine/SpineContext";
import { MenuButton } from "./MenuButton";
import { ToolsProvider, useToolsContext } from "./ToolsContext";
import { ToolsSection } from "./ToolsSection";

const toolPadding = {
  1: "pb-28",
  2: "pb-37.5",
  3: "pb-47",
  4: "pb-56.5",
  5: "pb-66",
};

const MenuContent: FC = () => {
  const { t } = useTranslation();
  const { menuIsCollapsed } = useWindowContext();
  const { visiblePages } = useSpineContext();
  const dispatch = useDispatch();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { mainPage } = usePagesContext();
  const { visibleTools } = useToolsContext();
  const toolCount = visibleTools.length;
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const onScroll = (event: Event) =>
    setCanScrollUp((event.target as HTMLDivElement).scrollTop > 0);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    const element = scrollRef.current;
    element.addEventListener("scroll", onScroll);
    return () => element.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

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
      {canScrollUp && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-1 h-6 bg-linear-to-b from-surface-base to-transparent" />
      )}

      <div className="mr-1 min-h-0 w-full overflow-y-auto pl-3" ref={scrollRef}>
        <div
          className={joinClasses([
            "flex flex-col gap-y-0.5 transition-[width]",
            menuIsCollapsed ? `w-10 ${toolPadding[toolCount]}` : "w-50 pb-28",
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

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-1 h-6 bg-linear-to-t from-surface-base to-transparent" />
    </div>
  );
};

export const Menu: FC = () => {
  return (
    <ToolsProvider>
      <MenuContent />
    </ToolsProvider>
  );
};
