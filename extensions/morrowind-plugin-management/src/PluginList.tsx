import DraggableList from './DraggableList';
import PluginEntry from './PluginEntry';

import * as React from 'react';
import { Panel } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { ComponentEx, DNDContainer, FlexLayout, MainPage } from 'vortex-api';

const PanelX: any = Panel;

export interface IPluginListProps {
  knownPlugins: string[];
  pluginOrder: string[];

  onSetPluginOrder: (enabled: string[]) => void;
}

class PluginList extends ComponentEx<IPluginListProps, {}> {
  public render(): JSX.Element {
    const { t, knownPlugins, pluginOrder } = this.props;
    const disabledPlugins = knownPlugins.filter(plugin => pluginOrder.indexOf(plugin) === -1);

    return (
      <MainPage>
        <MainPage.Body>
          <Panel id='morrowind-plugin-panel'>
            <PanelX.Body>
              <DNDContainer>
                <FlexLayout type='row'>
                  <FlexLayout.Flex>
                    <h4>{t('Enabled')}</h4>
                    <DraggableList
                      id='enabled'
                      items={pluginOrder}
                      itemRenderer={PluginEntry}
                      apply={this.applyEnabled}
                    />
                  </FlexLayout.Flex>
                  <FlexLayout.Flex>
                    <h4>{t('Disabled')}</h4>
                    <DraggableList
                      id='disabled'
                      items={disabledPlugins}
                      itemRenderer={PluginEntry}
                      apply={this.applyDisabled}
                    />
                  </FlexLayout.Flex>
                </FlexLayout>
              </DNDContainer>
            </PanelX.Body>
          </Panel>
        </MainPage.Body>
      </MainPage>
    );
  }

  private applyEnabled = (ordered: string[]) => {
    this.props.onSetPluginOrder(ordered);
  }

  private applyDisabled = (ordered: string[]) => {
    // this event doesn't really matter, does it?
  }
}

export default translate(['common', 'morrowind-plugins'], { wait: false })(PluginList);
