import {setPluginEnabled, setPluginOrder} from '../actions/loadOrder';
import {setAutoSortEnabled} from '../actions/settings';
import {ILoadOrder} from '../types/ILoadOrder';
import {
  IPluginCombined,
  IPluginLoot,
  IPluginParsed,
  IPlugins,
} from '../types/IPlugins';

import PluginFlags, {getPluginFlags} from './PluginFlags';

import * as Promise from 'bluebird';
import ESPFile from 'esptk';
import {SimpleMessage} from 'loot';
import {ComponentEx, ITableRowAction, IconBar,
        Table, selectors, tooltip, types, util} from 'nmm-api';
import * as React from 'react';
import update = require('react-addons-update');
import {Alert, ListGroup, ListGroupItem} from 'react-bootstrap';
import {translate} from 'react-i18next';
import {Fixed, Flex, Layout} from 'react-layout-pane';
import {connect} from 'react-redux';

interface IAttributeStateMap {
  [ attributeId: string ]: types.IAttributeState;
}

interface IBaseProps {
  nativePlugins: string[];
}

interface IConnectedProps {
  gameMode: string;
  plugins: IPlugins;
  loadOrder: { [name: string]: ILoadOrder };
  listState: { [attribute: string]: types.IAttributeState };
  autoSort: boolean;
  lootActivity: string;
}

interface IActionProps {
  onSetPluginEnabled: (pluginName: string, enabled: boolean) => void;
  onSetAutoSortEnabled: (enabled: boolean) => void;
  onSetPluginOrder: (pluginOrder: string[]) => void;
}

interface IComponentState {
  selectedPlugin: string;
  pluginsLoot: { [name: string]: IPluginLoot };
  pluginsParsed: { [name: string]: IPluginParsed };
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

function toHex(num: number) {
  if (num === undefined) {
    return 'FF';
  }
  let res = num.toString(16).toUpperCase();
  if (res.length < 2) {
    res = '0' + res;
  }
  return res;
}

class PluginList extends ComponentEx<IProps, IComponentState> {
  private staticButtons: types.IIconDefinition[];
  private pluginEnabledAttribute: types.ITableAttribute;
  private actions: ITableRowAction[];

  private pluginAttributes: types.ITableAttribute[] = [
    {
      id: 'name',
      name: 'Name',
      isToggleable: false,
      edit: {},
      isSortable: true,
      calc: (plugin: IPluginCombined) => plugin.name,
      placement: 'both',
    },
    {
      id: 'flags',
      name: 'Flags',
      icon: 'flag',
      isToggleable: true,
      edit: {},
      isSortable: false,
      customRenderer: (plugin: IPluginCombined, detail: boolean, t: I18next.TranslationFunction) =>
        <PluginFlags plugin={plugin} t={t} />,
      calc: (plugin: IPluginCombined, t) => getPluginFlags(plugin, t).length,
      placement: 'table',
    },
    {
      id: 'flags-detail',
      name: 'Flags',
      edit: {},
      calc: (plugin: IPluginCombined, t) => getPluginFlags(plugin, t),
      placement: 'detail',
    },
    {
      id: 'loadOrder',
      name: 'Load Order',
      icon: 'sort-numeric-asc',
      isToggleable: true,
      edit: {},
      isSortable: true,
      calc: (plugin: IPluginCombined) => plugin.loadOrder,
      placement: 'table',
    },
    {
      id: 'modIndex',
      name: 'Mod Index',
      icon: 'indent',
      isToggleable: true,
      edit: {},
      isSortable: true,
      calc: (plugin: IPluginCombined) => toHex(plugin.modIndex),
      placement: 'table',
    },
    {
      id: 'masters',
      name: 'Masters',
      edit: {},
      calc: (plugin: IPluginCombined) => plugin.masterList,
      placement: 'detail',
    },
    {
      id: 'loot_messages',
      name: 'Loot Messages',
      edit: {},
      customRenderer: this.renderLootMessages,
      calc: (plugin: IPluginCombined) => plugin.messages,
      placement: 'detail',
    },
  ];

  constructor(props) {
    super(props);
    this.state = {
      selectedPlugin: undefined,
      pluginsParsed: {},
      pluginsLoot: {},
    };
    const {t, onSetAutoSortEnabled} = props;

    this.actions = [
      {
        icon: 'check-square-o',
        title: 'Enable selected',
        action: this.enableSelected,
        singleRowAction: false,
      },
      {
        icon: 'square-o',
        title: 'Disable selected',
        action: this.disableSelected,
        singleRowAction: false,
      },
    ];

    this.pluginEnabledAttribute = {
      id: 'enabled',
      name: 'Enabled',
      description: 'Is plugin enabled in current profile',
      icon: 'check-o',
      calc: (plugin: IPluginCombined) => plugin.enabled,
      placement: 'table',
      isToggleable: false,
      edit: {
        onChangeValue: (pluginId: string, value: any) => props.onSetPluginEnabled(pluginId, value),
      },
      isSortable: false,
    };

    this.staticButtons = [
      {
        component: tooltip.ToggleButton,
        props: (): tooltip.ToggleButtonProps => {
          const {autoSort} = this.props;
          return {
            id: 'btn-autosort-loot',
            key: 'btn-autosort-loot',
            onIcon: 'lock',
            offIcon: 'unlock',
            tooltip: t('Autosort enabled (using LOOT)'),
            offTooltip: t('Autosort disabled (using LOOT)'),
            state: autoSort,
            onClick: () => onSetAutoSortEnabled(!autoSort),
          };
        },
      },
      {
        component: tooltip.IconButton,
        props: (): tooltip.IconButtonProps => {
          return {
            id: 'btn-sort',
            key: 'btn-sort',
            icon: 'sort-amount-asc',
            tooltip: t('Sort now'),
            onClick: () => this.context.api.events.emit('autosort-plugins'),
          };
        },
      },
    ];
  }

  public componentWillMount() {
    const { plugins } = this.props;

    let pluginNames: string[] = Object.keys(plugins);

    let stateUpdate = { pluginsParsed: {}, pluginsLoot: undefined };

    Promise.each(pluginNames, (pluginName: string) => {
      return new Promise((resolve, reject) => {
        let esp = new ESPFile(plugins[pluginName].filePath);
        stateUpdate.pluginsParsed[pluginName] = {
          $set: {
            isMaster: esp.isMaster,
            description: esp.description,
            author: esp.author,
            masterList: esp.masterList,
          },
        };
        resolve();
      });
    })
      .then(() => {
        this.context.api.events.emit('plugin-details',
          pluginNames, (resolved: { [name: string]: IPluginLoot }) => {
            stateUpdate.pluginsLoot = { $set: resolved };
            this.setState(update(this.state, stateUpdate));
          });
      });
  }

  public render(): JSX.Element {
    const { t, plugins, lootActivity } = this.props;

    const detailed = this.detailedPlugins(Object.keys(plugins));

    return (
      <Layout type='column'>
        <Fixed style={{minHeight: 32}}>
          <Layout type='row'>
            <Flex>
              <IconBar
                group='gamebryo-plugin-icons'
                staticElements={this.staticButtons}
              />
            </Flex>
            <Fixed>
              <h4>{t(lootActivity)}</h4>
            </Fixed>
          </Layout>
        </Fixed>
        <Flex>
          <Table
            tableId='gamebryo-plugins'
            actions={this.actions}
            staticElements={[this.pluginEnabledAttribute, ...this.pluginAttributes]}
            data={detailed}
          />
        </Flex>
      </Layout>
    );
  }

  private enableSelected = (pluginIds: string[]) => {
    const { listState, onSetPluginEnabled } = this.props;

    pluginIds.forEach((key: string) => {
      if (!util.getSafe(listState, [key, 'enabled'], false)) {
        onSetPluginEnabled(key, true);
      }
    });
  }

  private disableSelected = (pluginIds: string[]) => {
    const { listState, onSetPluginEnabled } = this.props;

    pluginIds.forEach((key: string) => {
      if (!listState[key].enabled) {
        onSetPluginEnabled(key, false);
      }
    });
  }

  private updateModIndex(pluginObjects: IPluginCombined[]) {
    // overly complicated?
    // This sorts the whole plugin list by the load order, inserting the installed
    // native plugins at the top in their hard-coded order. Then it assigns
    // the ascending mod index to all enabled plugins.

    let { nativePlugins } = this.props;
    let installedNative = nativePlugins.filter((name: string) => {
      return pluginObjects.find(
        (plugin: IPluginCombined) => name === plugin.name.toLowerCase()) !== undefined;
    });

    function nativeIdx(name: string): number {
      let idx = installedNative.indexOf(name.toLowerCase());
      return idx !== -1 ? idx : undefined;
    }

    let byLO = pluginObjects.sort((lhs: IPluginCombined, rhs: IPluginCombined) => {
      let lhsLO = lhs.isNative ? nativeIdx(lhs.name) : lhs.loadOrder + 1000;
      let rhsLO = rhs.isNative ? nativeIdx(rhs.name) : rhs.loadOrder + 1000;
      return lhsLO - rhsLO;
    });

    let modIndex = 0;
    byLO.forEach((plugin: IPluginCombined) => {
      if (plugin.enabled || plugin.isNative) {
        plugin.modIndex = modIndex++;
      }
    });
  }

  private detailedPlugins(pluginNames: string[]): { [id: string]: IPluginCombined } {
    const { plugins, loadOrder } = this.props;
    const {pluginsLoot, pluginsParsed} = this.state;

    let pluginObjects: IPluginCombined[] = pluginNames.map((pluginName: string) => {
      return Object.assign({}, {
        name: pluginName,
        modIndex: -1,
        enabled: plugins[pluginName].isNative ? undefined : false,
      }, plugins[pluginName], loadOrder[pluginName],
        pluginsLoot[pluginName], pluginsParsed[pluginName]);
    });

    this.updateModIndex(pluginObjects);

    let result: { [id: string]: IPluginCombined } = {};
    pluginObjects.forEach((plugin: IPluginCombined) => {
      result[plugin.name] = plugin;
    });

    return result;
  }

  private translateLootMessageType(input: string) {
    return {
      say: 'info',
      warn: 'warning',
      error: 'danger',
      unknown: 'warning',
    }[input];
  }

  private renderLootMessages = (plugin: IPluginCombined) => {
    if (plugin.messages === undefined) {
      return null;
    }

    return (
      <ListGroup>
        {
          plugin.messages.map((msg: SimpleMessage, idx: number) => (
            <ListGroupItem key={idx}>
              <Alert bsStyle={this.translateLootMessageType(msg.type)}>{msg.text}</Alert>
            </ListGroupItem>
          ))
        }
      </ListGroup>
    );
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    gameMode: selectors.activeProfile(state).gameId,
    plugins: state.session.plugins.pluginList,
    lootActivity: state.session.plugins.lootActivity,
    loadOrder: state.loadOrder,
    listState: state.settings.plugins.pluginlistState || {},
    autoSort: state.settings.plugins.autoSort,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetPluginEnabled: (pluginName: string, enabled: boolean) =>
      dispatch(setPluginEnabled(pluginName, enabled)),
    onSetAutoSortEnabled: (enabled: boolean) => {
      dispatch(setAutoSortEnabled(enabled));
    },
    onSetPluginOrder: (newOrder: string[]) => {
      dispatch(setPluginOrder(newOrder));
    },
  };
}

export default
  translate(['common', 'gamebryo-plugin'], {wait: false})(
    connect(mapStateToProps, mapDispatchToProps)(
      PluginList
    )
  ) as React.ComponentClass<IBaseProps>;
