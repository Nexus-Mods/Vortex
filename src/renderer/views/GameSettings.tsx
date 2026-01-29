import * as React from "react";
import { Panel, Tab, Tabs } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import type { IBaseProps } from "../../extensions/settings_interface/SettingsInterface";
import type { PropsCallbackTyped } from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import type startupSettingsT from "../../util/startupSettings";

import { setSettingsPage } from "../../actions/session";
import { useExtensionObjects } from "../../util/ExtensionProvider";
import lazyRequire from "../../util/lazyRequire";
import makeReactive from "../../util/makeReactive";
import EmptyPlaceholder from "../controls/EmptyPlaceholder";
import MainPage from "./MainPage";

const startupSettings = lazyRequire(
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require("../../util/startupSettings") as typeof startupSettingsT,
  "default",
);

interface ISettingsPage {
  title: string;
  component: React.ComponentType<IBaseProps>;
  props: PropsCallbackTyped<IBaseProps>;
  visible: () => boolean;
  priority: number;
}

interface ICombinedSettingsPage {
  priority: number;
  title: string;
  elements: ISettingsPage[];
}

type TabSelectHandler = React.ComponentProps<typeof Tabs>["onSelect"];

function registerSettings(
  _instanceGroup: undefined,
  title: string,
  component: React.ComponentType<IBaseProps>,
  props: PropsCallbackTyped<IBaseProps>,
  visible: () => boolean,
  priority?: number,
): ISettingsPage {
  return { title, component, props, visible, priority: priority || 100 };
}

export const GameSettings: React.FC = () => {
  const { t } = useTranslation(["common"]);
  const dispatch = useDispatch();

  // Get extension objects using the hook instead of HOC
  const objects = useExtensionObjects<ISettingsPage>(registerSettings);

  const settingsPage = useSelector(
    (state: IState) => state.session.base.settingsPage || undefined,
  );

  const startupSettingsRef = React.useRef(makeReactive(startupSettings));

  const changeStartup = React.useCallback((key: string, value: unknown) => {
    startupSettingsRef.current[key] = value;
  }, []);

  const setCurrentPage: TabSelectHandler = React.useCallback(
    (eventKey) => {
      if (typeof eventKey === "string") {
        dispatch(setSettingsPage(eventKey));
      }
    },
    [dispatch],
  );

  const sortByPriority = (
    lhs: ICombinedSettingsPage,
    rhs: ICombinedSettingsPage,
  ) => {
    return lhs.priority - rhs.priority;
  };

  const renderTabElement = (page: ISettingsPage, idx: number): JSX.Element => {
    const props = page.props ? page.props() : {};
    return (
      <Panel key={idx}>
        <Panel.Body>
          {idx !== 0 ? <hr style={{ marginTop: 0 }} /> : null}

          <page.component
            {...props}
            changeStartup={changeStartup}
            startup={startupSettingsRef.current}
          />
        </Panel.Body>
      </Panel>
    );
  };

  // Check if a setting is per-game (has a visibility condition and is currently visible)
  const isPerGameSetting = (ele: ISettingsPage): boolean =>
    ele.visible !== undefined && ele.visible();

  const renderTab = (page: ICombinedSettingsPage): JSX.Element => {
    // Only show per-game settings (has visibility condition AND currently visible)
    const elements = page.elements
      .filter(isPerGameSetting)
      .sort((lhs, rhs) => lhs.priority - rhs.priority);

    const content =
      elements.length > 0 ? (
        <div>{elements.map(renderTabElement)}</div>
      ) : (
        <EmptyPlaceholder
          fill={true}
          icon="settings"
          subtext={t("This game has no specific settings in this category.")}
          text={t("Nothing to configure.")}
        />
      );

    return (
      <Tab eventKey={page.title} key={page.title} title={t(page.title)}>
        <div>{content}</div>
      </Tab>
    );
  };

  // Filter out tabs that have no per-game settings for the current game
  const tabsWithPerGameSettings = (tabs: ICombinedSettingsPage[]) =>
    tabs.filter((tab) => tab.elements.some(isPerGameSetting));

  // Combine all settings by title
  const combined = objects.reduce(
    (prev: ICombinedSettingsPage[], current: ISettingsPage) => {
      const result = prev.slice();
      const existingPage = prev.find(
        (ele: ICombinedSettingsPage) => ele.title === current.title,
      );
      if (existingPage === undefined) {
        result.push({
          title: current.title,
          elements: [current],
          priority: current.priority,
        });
      } else {
        existingPage.elements.push(current);
        if (
          existingPage.priority === undefined ||
          current.priority < existingPage.priority
        ) {
          existingPage.priority = current.priority;
        }
      }
      return result;
    },
    [],
  );

  // Only show tabs that have at least one per-game setting for the current game
  const visibleTabs = tabsWithPerGameSettings(combined).sort(sortByPriority);

  if (visibleTabs.length === 0) {
    return (
      <MainPage>
        <MainPage.Body>
          <EmptyPlaceholder
            fill={true}
            icon="settings"
            subtext={t("No game-specific settings available.")}
            text={t("Nothing to configure.")}
          />
        </MainPage.Body>
      </MainPage>
    );
  }

  const page =
    visibleTabs.find((iter) => iter.title === settingsPage) !== undefined
      ? settingsPage
      : visibleTabs[0].title;

  return (
    <MainPage>
      <MainPage.Body>
        <Tabs activeKey={page} id="game-settings-tab" onSelect={setCurrentPage}>
          {visibleTabs.map(renderTab)}
        </Tabs>
      </MainPage.Body>
    </MainPage>
  );
};

export default GameSettings;
