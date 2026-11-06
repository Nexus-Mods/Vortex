import React, { type FC, useCallback, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setOpenMainPage } from "../../actions/session";
import { usePagesContext, useWindowContext } from "../../contexts";
import FlexLayout from "../../controls/FlexLayout";
import { hasModsForActiveGame } from "../../extensions/mod_management/selectors";
import { usePageRendering } from "../../hooks";
import { defaultState as sessionDefaultState } from "../../reducers/session";
import {
  activeGameId as activeGameIdSelector,
  commandLineGameId as commandLineGameIdSelector,
} from "../../util/selectors";
import { ContentPane, Sidebar } from "./index";

let startupPageChosen = false;

/**
 * Provides main layout with a Sidebar and ContentPane.
 * For Classic layout.
 */
export const MainLayout: FC<React.PropsWithChildren<unknown>> = () => {
  const { mainPages, mainPage } = usePagesContext();

  const dispatch = useDispatch();
  const activeGameId = useSelector(activeGameIdSelector);
  const requestedGameId = useSelector(commandLineGameIdSelector);
  const hasMods = useSelector(hasModsForActiveGame);

  const { secondaryPage, setLoadedPages, renderPage } = usePageRendering();

  const { menuIsCollapsed, setMenuIsCollapsed } = useWindowContext();

  const sidebarRef = useRef<HTMLElement | null>(null);
  const sidebarTimer = useRef<NodeJS.Timeout | undefined>(undefined);

  // Choose the startup page once per run, preserving the current page if it's still valid
  useEffect(() => {
    if (startupPageChosen || mainPages.length === 0) {
      return;
    }

    const onStartupPage = mainPage === sessionDefaultState.mainPage;

    if (onStartupPage && requestedGameId !== undefined && activeGameId !== requestedGameId) {
      return;
    }
    startupPageChosen = true;

    if (onStartupPage && activeGameId !== undefined) {
      const modsPage = hasMods ? mainPages.find((p) => p.id === "Mods") : undefined;
      const startPage = modsPage ?? mainPages.find((p) => p.group === "dashboard") ?? mainPages[0];
      dispatch(setOpenMainPage(startPage.id, false));
    } else if (!mainPages.some((p) => p.id === mainPage)) {
      dispatch(setOpenMainPage(mainPages[0].id, false));
    }
  }, [mainPages, mainPage, activeGameId, requestedGameId, hasMods, dispatch]);

  const setMainPage = useCallback(
    (pageId: string, secondary: boolean) => {
      setLoadedPages(pageId);
      setImmediate(() => {
        if (secondary && pageId === secondaryPage) {
          dispatch(setOpenMainPage("", secondary));
        } else {
          dispatch(setOpenMainPage(pageId, secondary));
        }
      });
    },
    [secondaryPage, dispatch],
  );

  const handleClickPage = useCallback(
    (pageId: string, ctrlKey: boolean) => {
      if (mainPage !== pageId) {
        setMainPage(pageId, ctrlKey);
      } else {
        const page = mainPages.find((iter) => iter.id === mainPage);
        page?.onReset?.();
      }
    },
    [mainPage, mainPages, setMainPage],
  );

  const handleSidebarRef = useCallback((ref: HTMLElement | null) => {
    sidebarRef.current = ref;
    if (ref !== null) {
      ref.setAttribute("style", "min-width: " + ref.getBoundingClientRect().width + "px");
    }
  }, []);

  const handleToggleMenu = useCallback(() => {
    const newMinimized = !menuIsCollapsed;
    setMenuIsCollapsed(newMinimized);
    if (sidebarTimer.current !== undefined) {
      clearTimeout(sidebarTimer.current);
      sidebarTimer.current = undefined;
    }
    if (sidebarRef.current !== null) {
      if (newMinimized) {
        sidebarRef.current.setAttribute("style", "");
      } else {
        sidebarTimer.current = setTimeout(() => {
          sidebarTimer.current = undefined;
          sidebarRef.current?.setAttribute?.(
            "style",
            "min-width:" + sidebarRef.current.getBoundingClientRect().width + "px",
          );
        }, 500);
      }
    }
  }, [menuIsCollapsed, setMenuIsCollapsed]);

  useEffect(() => {
    return () => {
      if (sidebarTimer.current !== undefined) {
        clearTimeout(sidebarTimer.current);
      }
    };
  }, []);

  return (
    <FlexLayout.Flex>
      <FlexLayout style={{ overflow: "hidden" }} type="row">
        <Sidebar
          pages={mainPages}
          onClickPage={handleClickPage}
          onSidebarRef={handleSidebarRef}
          onToggleMenu={handleToggleMenu}
        />

        <ContentPane>{mainPages.map(renderPage)}</ContentPane>
      </FlexLayout>
    </FlexLayout.Flex>
  );
};
