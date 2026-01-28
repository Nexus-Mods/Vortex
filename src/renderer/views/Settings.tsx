import type * as Redux from "redux";
import type { ThunkDispatch } from "redux-thunk";

import * as React from "react";
import { Panel, Tab, Tabs } from "react-bootstrap";

import type { PropsCallback } from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import type { IParameters } from "../../util/commandLine";
import type startupSettingsT from "../../util/startupSettings";

import { setSettingsPage } from "../../actions/session";
import lazyRequire from "../../util/lazyRequire";
import makeReactive from "../../util/makeReactive";
import {
  ComponentEx,
  connect,
  extend,
  translate,
} from "../controls/ComponentEx";
import EmptyPlaceholder from "../controls/EmptyPlaceholder";
import MainPage from "./MainPage";

const startupSettings = lazyRequire<typeof startupSettingsT>(
  () => require("../../util/startupSettings"),
  "default",
);

interface ISettingsPage {
  title: string;
  component: React.ComponentClass<any>;
  props: PropsCallback;
  visible: () => boolean;
  priority: number;
}

interface ICombinedSettingsPage {
  priority: number;
  title: string;
  elements: ISettingsPage[];
}

interface ISettingsProps {
  objects: ISettingsPage[];
}

interface IConnectedProps {
  settingsPage: string;
}

interface IActionProps {
  onSetPage: (page: string) => void;
}

type IProps = ISettingsProps & IConnectedProps & IActionProps;

/**
 * settings dialog
 *
 * @class Settings
 * @extends {ComponentEx<ISettingsProps, {}>}
 */
class Settings extends ComponentEx<IProps, {}> {
  private mStartupSettings: IParameters;

  constructor(props: IProps) {
    super(props);
    this.mStartupSettings = makeReactive(startupSettings);
  }

  public render(): JSX.Element {
    const { settingsPage, objects } = this.props;

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
          <Tabs
            activeKey={page}
            id="settings-tab"
            onSelect={this.setCurrentPage}
          >
            {combined.sort(this.sortByPriority).map(this.renderTab)}
          </Tabs>
        </MainPage.Body>
      </MainPage>
    );
  }

  private renderTab = (page: ICombinedSettingsPage): JSX.Element => {
    const { t } = this.props;

    const elements = page.elements
      .filter((ele) => ele.visible === undefined || ele.visible())
      .sort((lhs, rhs) => lhs.priority - rhs.priority);

    const content =
      elements.length > 0 ? (
        <div>{elements.map(this.renderTabElement)}</div>
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

  private renderTabElement = (
    page: ISettingsPage,
    idx: number,
  ): JSX.Element => {
    const props = page.props !== undefined ? page.props() : {};
    return (
      <Panel key={idx}>
        <Panel.Body>
          {idx !== 0 ? <hr style={{ marginTop: 0 }} /> : null}

          <page.component
            {...props}
            changeStartup={this.changeStartup}
            startup={this.mStartupSettings}
          />
        </Panel.Body>
      </Panel>
    );
  };

  private sortByPriority = (
    lhs: ICombinedSettingsPage,
    rhs: ICombinedSettingsPage,
  ) => {
    return lhs.priority - rhs.priority;
  };

  private setCurrentPage = (page) => {
    this.props.onSetPage(page);
  };

  private changeStartup = (key: string, value: any) => {
    this.mStartupSettings[key] = value;
  };
}

function registerSettings(
  instanceGroup: undefined,
  title: string,
  component: React.ComponentClass<any>,
  props: PropsCallback,
  visible: () => boolean,
  priority?: number,
): ISettingsPage {
  return { title, component, props, visible, priority: priority || 100 };
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    settingsPage: state.session.base.settingsPage || undefined,
  };
}

function mapDispatchToProps(
  dispatch: ThunkDispatch<any, null, Redux.Action>,
): IActionProps {
  return {
    onSetPage: (title: string) => dispatch(setSettingsPage(title)),
  };
}

export default translate(["common"])(
  connect(
    mapStateToProps,
    mapDispatchToProps,
  )(extend(registerSettings)(Settings)),
) as React.ComponentClass<{}>;
