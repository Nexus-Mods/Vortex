import { setSettingsPage } from '../actions/session';
import { PropsCallback } from '../types/IExtensionContext';
import { IState } from '../types/IState';
import { ComponentEx, connect, extend, translate } from '../util/ComponentEx';

import * as React from 'react';
import { Panel, Tab, Tabs } from 'react-bootstrap';

interface ISettingsPage {
  title: string;
  component: React.ComponentClass<any>;
  props: PropsCallback;
}

interface ICombinedSettingsPage {
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
  public render(): JSX.Element {
    const { settingsPage, objects } = this.props;

    const combined = objects.reduce((prev: ICombinedSettingsPage[], current: ISettingsPage) => {
      const result = prev.slice();
      const page = prev.find((ele: ICombinedSettingsPage) => ele.title === current.title);
      if (page === undefined) {
        result.push({ title: current.title, elements: [ current ] });
      } else {
        page.elements.push(current);
      }
      return result;
    }, []);

    const page = combined.find(iter => iter.title === settingsPage) !== undefined
      ? settingsPage : combined[0].title;

    return (
      <Tabs id='settings-tab' activeKey={page} onSelect={this.setCurrentPage}>
        { combined.map(this.renderTab) }
      </Tabs>
    );
  }

  private renderTab = (page: ICombinedSettingsPage): JSX.Element => {
    const { t } = this.props;

    return (
      <Tab key={page.title} eventKey={page.title} title={t(page.title)}>
        <div>
          {page.elements.map(this.renderTabElement)}
        </div>
      </Tab>
    );
  }

  private renderTabElement = (page: ISettingsPage, idx: number): JSX.Element => {
    const props = page.props !== undefined ? page.props() : {};
    return <Panel key={idx}><page.component {...props} /></Panel>;
  }

  private setCurrentPage = (page) => {
    this.props.onSetPage(page);
  }
}

function registerSettings(instanceProps: ISettingsProps,
                          title: string,
                          component: React.ComponentClass<any>,
                          props: PropsCallback): ISettingsPage {
  return { title, component, props };
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    settingsPage: state.session.base.settingsPage,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetPage: (title: string) => dispatch(setSettingsPage(title)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      extend(registerSettings)(
        Settings))) as React.ComponentClass<{}>;
