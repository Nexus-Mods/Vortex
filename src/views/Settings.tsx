import { PropsCallback } from '../types/IExtensionContext';
import { ComponentEx, extend, translate } from '../util/ComponentEx';

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

/**
 * settings dialog
 * 
 * @class Settings
 * @extends {ComponentEx<ISettingsProps, {}>}
 */
class Settings extends ComponentEx<ISettingsProps, {}> {
  constructor(props) {
    super(props);
  }

  public render(): JSX.Element {
    const { objects } = this.props;
    let combined = objects.reduce((prev, current: ISettingsPage) => {
      let result = prev.slice();
      const page = prev.find((ele: ISettingsPage) => ele.title === current.title);
      if (page === undefined) {
        result.push({ title: current.title, elements: [ current ] });
      } else {
        page.elements.push(current);
      }
      return result;
    }, []);
    return (
      <Tabs id='settings-tab'>
        { combined.map(this.renderTab) }
      </Tabs>
    );
  }

  private renderTab = (page: ICombinedSettingsPage): JSX.Element => {
    const { t } = this.props;

    return (
      <Tab key={page.title} eventKey={page.title} title={t(page.title)}>
      <div>
      { page.elements.map(this.renderTabElement) }
      </div>
      </Tab>
    );
  }

  private renderTabElement = (page: ISettingsPage, idx: number): JSX.Element => {
    let props = page.props !== undefined ? page.props() : {};
    return <Panel key={idx}><page.component {...props} /></Panel>;
  }
}

function registerSettings(instance: Settings,
                          title: string,
                          component: React.ComponentClass<any>,
                          props: () => PropsCallback): ISettingsPage {
  return { title, component, props };
}

export default
  translate(['common'], { wait: false })(
    extend(registerSettings)(Settings)
  ) as React.ComponentClass<{}>;
