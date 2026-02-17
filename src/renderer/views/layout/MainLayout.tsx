import React, { type FC, useCallback, useEffect, useRef } from "react";
import { useDispatch } from "react-redux";

import { setOpenMainPage } from "../../actions/session";
import { usePagesContext, useWindowContext } from "../../contexts";
import FlexLayout from "../../controls/FlexLayout";
import { usePageRendering } from "../../hooks";
import { ContentPane, Sidebar } from "./index";

/**
 * Provides main layout with a Sidebar and ContentPane.
 * For Classic layout.
 */
export const MainLayout: FC = () => {
  const { mainPages, mainPage } = usePagesContext();

  const dispatch = useDispatch();

  const { secondaryPage, setLoadedPages, renderPage } = usePageRendering();

  const { menuIsCollapsed, setMenuIsCollapsed } = useWindowContext();

  const sidebarRef = useRef<HTMLElement | null>(null);
  const sidebarTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const initializedRef = useRef(false);

  // Set initial page on mount (first page from sorted list)
  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    if (mainPages.length > 0) {
      dispatch(setOpenMainPage(mainPages[0].title, false));
    }
  }, [mainPages, dispatch]);

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
      ref.setAttribute(
        "style",
        "min-width: " + ref.getBoundingClientRect().width + "px",
      );
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
            "min-width:" +
              sidebarRef.current.getBoundingClientRect().width +
              "px",
          );
        }, 500);
      }
    }
  }, [menuIsCollapsed, setMenuIsCollapsed]);

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
