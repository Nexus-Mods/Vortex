import { setOpenMainPage } from "../../../actions/session";
import { setTabsMinimized } from "../../../actions/window";
import * as React from "react";
import FlexLayout from "../../controls/FlexLayout";
import type { IMainPage } from "../../../types/IMainPage";
import type { IState } from "../../../types/IState";
import { getSafe } from "../../../util/storeHelper";
import MainPageContainer from "../MainPageContainer";
import Settings from "../Settings";
import { useDispatch, useSelector } from "react-redux";
import { ContentPane, Sidebar } from "./index";

const settingsPage: IMainPage = {
  id: "application_settings",
  title: "Settings",
  group: "global",
  component: Settings,
  icon: "settings",
  propsFunc: () => undefined,
  visible: () => true,
};

export interface IMainLayoutProps {
  objects: IMainPage[];
}

export const MainLayout = (props: IMainLayoutProps): JSX.Element => {
  const { objects } = props;
  const dispatch = useDispatch();

  const mainPage = useSelector((state: IState) => state.session.base.mainPage);
  const secondaryPage = useSelector(
    (state: IState) => state.session.base.secondaryPage,
  );
  const tabsMinimized = useSelector((state: IState) =>
    getSafe(state, ["settings", "window", "tabsMinimized"], false),
  );

  const [loadedPages, setLoadedPages] = React.useReducer(
    (prev: string[], pageId: string) =>
      prev.includes(pageId) ? prev : [...prev, pageId],
    mainPage ? [mainPage] : [],
  );

  // Track mainPage changes and add to loadedPages if needed
  React.useEffect(() => {
    if (mainPage) {
      setLoadedPages(mainPage);
    }
  }, [mainPage]);

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
    (evt: React.MouseEvent) => {
      if (mainPage !== evt.currentTarget.id) {
        setMainPage(evt.currentTarget.id, evt.ctrlKey);
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

  const renderPage = (page: IMainPage) => {
    if (loadedPages.indexOf(page.id) === -1) {
      return null;
    }

    const active = [mainPage, secondaryPage].indexOf(page.id) !== -1;

    return (
      <MainPageContainer
        key={page.id}
        page={page}
        active={active}
        secondary={secondaryPage === page.id}
      />
    );
  };

  return (
    <FlexLayout.Flex>
      <FlexLayout type="row" style={{ overflow: "hidden" }}>
        <Sidebar
          objects={objects}
          settingsPage={settingsPage}
          onClickPage={handleClickPage}
          onToggleMenu={handleToggleMenu}
          onSidebarRef={handleSidebarRef}
        />
        <ContentPane>
          {objects.map(renderPage)}
          {renderPage(settingsPage)}
        </ContentPane>
      </FlexLayout>
    </FlexLayout.Flex>
  );
};
