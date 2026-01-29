import * as React from "react";
import { useDispatch, useSelector } from "react-redux";

import type { IMainPage } from "../../../types/IMainPage";
import type { IState } from "../../../types/IState";

import { setOpenMainPage } from "../../../actions/session";
import { setTabsMinimized } from "../../../actions/window";
import { getSafe } from "../../../util/storeHelper";
import FlexLayout from "../../controls/FlexLayout";
import { ContentPane, Sidebar } from "./index";
import { settingsPage, usePageRendering } from "./usePageRendering";

export interface IMainLayoutProps {
  objects: IMainPage[];
}

export const MainLayout = (props: IMainLayoutProps): JSX.Element => {
  const { objects } = props;
  const dispatch = useDispatch();

  const { mainPage, secondaryPage, setLoadedPages, renderPage } =
    usePageRendering();

  const tabsMinimized = useSelector((state: IState) =>
    getSafe(state, ["settings", "window", "tabsMinimized"], false),
  );

  const sidebarRef = React.useRef<HTMLElement | null>(null);
  const sidebarTimer = React.useRef<NodeJS.Timeout | undefined>(undefined);

  const setMainPage = React.useCallback(
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

  const handleClickPage = React.useCallback(
    (pageId: string, ctrlKey: boolean) => {
      if (mainPage !== pageId) {
        setMainPage(pageId, ctrlKey);
      } else {
        const page = objects.find((iter) => iter.id === mainPage);
        page?.onReset?.();
      }
    },
    [mainPage, objects, setMainPage],
  );

  const handleSidebarRef = React.useCallback((ref: HTMLElement | null) => {
    sidebarRef.current = ref;
    if (ref !== null) {
      ref.setAttribute(
        "style",
        "min-width: " + ref.getBoundingClientRect().width + "px",
      );
    }
  }, []);

  const handleToggleMenu = React.useCallback(() => {
    const newMinimized = !tabsMinimized;
    dispatch(setTabsMinimized(newMinimized));
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
  }, [tabsMinimized, dispatch]);

  return (
    <FlexLayout.Flex>
      <FlexLayout style={{ overflow: "hidden" }} type="row">
        <Sidebar
          objects={objects}
          settingsPage={settingsPage}
          onClickPage={handleClickPage}
          onSidebarRef={handleSidebarRef}
          onToggleMenu={handleToggleMenu}
        />

        <ContentPane>
          {objects.map(renderPage)}

          {renderPage(settingsPage)}
        </ContentPane>
      </FlexLayout>
    </FlexLayout.Flex>
  );
};
