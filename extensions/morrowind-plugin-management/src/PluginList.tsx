import PluginEntry from './PluginEntry';

import * as React from 'react';
import { ListGroup, ListGroupItem, Panel } from 'react-bootstrap';
import { DragSource, DropTarget } from 'react-dnd';
import HTML5Backend from 'react-dnd-html5-backend';
import { ComponentEx, MainPage } from 'vortex-api';

const PanelX: any = Panel;

export interface IPluginListProps {
  knownPlugins: string[];
  pluginOrder: string[];
}

interface IPluginListState {
  enabledPlugins: string[];
  disabledPlugins: string[];
}

class PluginList extends ComponentEx<IPluginListProps, IPluginListState> {
  constructor(props: IPluginListProps) {
    super(props);
    this.state = this.genPluginState(props);
  }

  public componentWillReceiveProps(newProps: IPluginListProps) {
    this.setState(this.genPluginState(newProps));
  }

  public render(): JSX.Element {
    const { disabledPlugins, enabledPlugins } = this.state;
    return (
      <MainPage>
        <MainPage.Body>
          <Panel>
            <PanelX.Body>
              <ListGroup>
                {enabledPlugins.map((plugin, idx) =>
                  <PluginEntry index={idx} key={plugin} plugin={plugin} />)}
              </ListGroup>
              <ListGroup>
                {disabledPlugins.map((plugin, idx) =>
                  <PluginEntry index={idx} key={plugin} plugin={plugin} />)}
              </ListGroup>
            </PanelX.Body>
          </Panel>
        </MainPage.Body>
      </MainPage>
    );
  }

  private genPluginState(props: IPluginListProps) {
    const { knownPlugins, pluginOrder } = this.props;
    return {
      enabledPlugins: pluginOrder,
      disabledPlugins: knownPlugins.filter(plugin => pluginOrder.indexOf(plugin) === -1),
    };
  }
}

export default PluginList;
