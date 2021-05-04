import { setSettingsPage } from '../actions/session';
import EmptyPlaceholder from '../controls/EmptyPlaceholder';
import { PropsCallback } from '../types/IExtensionContext';
import { IState } from '../types/IState';
import { ComponentEx, connect, extend, translate } from '../util/ComponentEx';
import * as fs from '../util/fs';
import { writeFileAtomic } from '../util/fsAtomic';
import lazyRequire from '../util/lazyRequire';
import { log } from '../util/log';
import makeReactive from '../util/makeReactive';
import startupSettingsT from '../util/startupSettings';

import MainPage from './MainPage';

import * as React from 'react';
import { Panel, Tab, Tabs } from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

const startupSettings =
  lazyRequire<typeof startupSettingsT>(() => require('../util/startupSettings'), 'default');

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
  private mStartupSettings;

  constructor(props: IProps) {
    super(props);
    this.mStartupSettings = makeReactive(startupSettings);
  }

  public render(): JSX.Element {
    const { settingsPage, objects } = this.props;

    const combined = objects.reduce((prev: ICombinedSettingsPage[], current: ISettingsPage) => {
      const result = prev.slice();
      const existingPage = prev.find((ele: ICombinedSettingsPage) => ele.title === current.title);
      if (existingPage === undefined) {
        result.push({ title: current.title, elements: [ current ], priority: current.priority });
      } else {
        existingPage.elements.push(current);
        if ((existingPage.priority === undefined) || (current.priority < existingPage.priority)) {
          existingPage.priority = current.priority;
        }
      }
      return result;
    }, []);

    const page = combined.find(iter => iter.title === settingsPage) !== undefined
      ? settingsPage : combined[0].title;

    return (
      <MainPage>
        <MainPage.Body>
          <Tabs id='settings-tab' activeKey={page} onSelect={this.setCurrentPage}>
            {combined.sort(this.sortByPriority).map(this.renderTab)}
          </Tabs>
        </MainPage.Body>
      </MainPage>
    );
  }

  private renderTab = (page: ICombinedSettingsPage): JSX.Element => {
    const { t } = this.props;

    const elements = page.elements
      .filter(ele => (ele.visible === undefined) || ele.visible())
      .sort((lhs, rhs) => lhs.priority - rhs.priority);

    const content = (elements.length > 0)
      ? (
        <div>
          {elements.map(this.renderTabElement)}
        </div>
      ) : (
        <EmptyPlaceholder
          icon='settings'
          text={t('Nothing to configure.')}
          subtext={t('Other games may require settings here.')}
        />
      );

    return (
      <Tab key={page.title} eventKey={page.title} title={t(page.title)}>
        <div>
          {content}
        </div>
      </Tab>
    );
  }

  private renderTabElement = (page: ISettingsPage, idx: number): JSX.Element => {
    const props = page.props !== undefined ? page.props() : {};
    const PanelX: any = Panel;
    return (
      <Panel key={idx}>
        <PanelX.Body>
        {idx !== 0 ? <hr style={{ marginTop: 0 }} /> : null}
        <page.component
          {...props}
          startup={this.mStartupSettings}
          changeStartup={this.changeStartup}
        />
        </PanelX.Body>
      </Panel>
    );
  }

  private sortByPriority = (lhs: ICombinedSettingsPage, rhs: ICombinedSettingsPage) => {
    return lhs.priority - rhs.priority;
  }

  private setCurrentPage = (page) => {
    this.props.onSetPage(page);
  }

  private changeStartup = (key: string, value: any) => {
    this.mStartupSettings[key] = value;
  }
}

function registerSettings(instanceGroup: undefined,
                          title: string,
                          component: React.ComponentClass<any>,
                          props: PropsCallback,
                          visible: () => boolean,
                          priority?: number): ISettingsPage {
  return { title, component, props, visible, priority: priority || 100 };
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    settingsPage: state.session.base.settingsPage || undefined,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetPage: (title: string) => dispatch(setSettingsPage(title)),
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(
      extend(registerSettings)(
        Settings))) as React.ComponentClass<{}>;
