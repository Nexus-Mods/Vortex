import * as React from "react";
import { Panel, Tab, Tabs } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import type { PropsCallback } from "../../types/IExtensionContext";
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
  component: React.ComponentClass;
  props: PropsCallback;
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
  instanceGroup: undefined,
  title: string,
  component: React.ComponentClass,
  props: PropsCallback,
  visible: () => boolean,
  priority?: number,
): ISettingsPage {
  return { title, component, props, visible, priority: priority || 100 };
}

export const Settings: React.FC = () => {
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
      dispatch(setSettingsPage(eventKey));
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
    const props = page.props !== undefined ? page.props() : {};
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

  const renderTab = (page: ICombinedSettingsPage): JSX.Element => {
    const elements = page.elements
      .filter((ele) => ele.visible === undefined || ele.visible())
      .sort((lhs, rhs) => lhs.priority - rhs.priority);

    const content =
      elements.length > 0 ? (
        <div>{elements.map(renderTabElement)}</div>
      ) : (
        <EmptyPlaceholder
          icon="settings"
          subtext={t("Other games may require settings here.")}
          text={t("Nothing to configure.")}
        />
      );

    return (
      <Tab eventKey={page.title} key={page.title} title={t(page.title)}>
        <div>{content}</div>
      </Tab>
    );
  };

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

  const page =
    combined.find((iter) => iter.title === settingsPage) !== undefined
      ? settingsPage
      : combined[0].title;

  return (
    <MainPage>
      <MainPage.Body>
        <Tabs activeKey={page} id="settings-tab" onSelect={setCurrentPage}>
          {combined.sort(sortByPriority).map(renderTab)}
        </Tabs>
      </MainPage.Body>
    </MainPage>
  );
};

export default Settings;
