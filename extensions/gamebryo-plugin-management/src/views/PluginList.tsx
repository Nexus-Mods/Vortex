import {setPluginEnabled, setPluginOrder} from '../actions/loadOrder';
import {setAutoSortEnabled} from '../actions/settings';
import {ILoadOrder} from '../types/ILoadOrder';
import {
  IPluginCombined,
  IPluginLoot,
  IPluginParsed,
  IPlugins,
} from '../types/IPlugins';

import DependencyIcon from './DependencyIcon';
import MasterList from './MasterList';
import PluginFlags, {getPluginFlags} from './PluginFlags';
import PluginFlagsFilter from './PluginFlagsFilter';

import * as Promise from 'bluebird';
import ESPFile from 'esptk';
import {SimpleMessage} from 'loot';
import {ComponentEx, IconBar, ITableRowAction, MainPage,
        selectors, Table, TableTextFilter, ToolbarIcon,
        types, util} from 'nmm-api';
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
  pluginsCombined: { [name: string]: IPluginCombined };
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

function num(num: number) {
  return num !== undefined && num !== null ? num : -1;
}

class PluginList extends ComponentEx<IProps, IComponentState> {
  private staticButtons: types.IActionDefinition[];
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
      filter: new TableTextFilter(true),
    },
    {
      id: 'flags',
      name: 'Flags',
      icon: 'flag',
      isToggleable: true,
      edit: {},
      isSortable: true,
      customRenderer: (plugin: IPluginCombined, detail: boolean, t: I18next.TranslationFunction) =>
        <PluginFlags plugin={plugin} t={t} />,
      calc: (plugin: IPluginCombined, t) => getPluginFlags(plugin, t),
      sortFunc: (lhs: string[], rhs: string[]) => lhs.length - rhs.length,
      filter: new PluginFlagsFilter(),
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
      sortFunc: (lhs: number, rhs: number) => num(lhs) - num(rhs),
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
      id: 'dependencies',
      name: 'Dependencies',
      description: 'Relations to other plugins',
      icon: 'plug',
      placement: 'table',
      customRenderer: (plugin: IPluginCombined, detail: boolean, t: I18next.TranslationFunction) =>
        <DependencyIcon plugin={plugin} t={t} />,
      calc: (mod) => null,
      isToggleable: true,
      edit: {},
      isSortable: false,
    },
    {
      id: 'masters',
      name: 'Masters',
      edit: {},
      customRenderer: (plugin: IPluginCombined, detail: boolean, t: I18next.TranslationFunction) =>
        <MasterList masters={plugin.masterList} />,
      calc: (plugin: IPluginCombined) => plugin.masterList,
      placement: 'detail',
    },
    {
      id: 'loot_messages',
      name: 'Loot Messages',
      edit: {},
      customRenderer: (plugin: IPluginCombined) => this.renderLootMessages(plugin),
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
      pluginsCombined: {},
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
        component: ToolbarIcon,
        props: () => {
          const {autoSort} = this.props;
          return {
            id: 'btn-autosort-loot',
            key: 'btn-autosort-loot',
            icon: autoSort ? 'lock' : 'unlock',
            text: autoSort ? t('Autosort enabled (using LOOT)')
                           : t('Autosort disabled (using LOOT)'),
            state: autoSort,
            onClick: () => onSetAutoSortEnabled(!autoSort),
          };
        },
      },
      {
        component: ToolbarIcon,
        props: () => {
          return {
            id: 'btn-sort',
            key: 'btn-sort',
            icon: 'sort-amount-asc',
            text: t('Sort now'),
            onClick: () => this.context.api.events.emit('autosort-plugins'),
          };
        },
      },
    ];
  }

  public componentWillMount() {
    this.updatePlugins(this.props.plugins);
  }

  public componentWillReceiveProps(nextProps) {
    if (this.props.plugins !== nextProps.plugins) {
      this.updatePlugins(nextProps.plugins);
    }

    if (this.props.loadOrder !== nextProps.loadOrder) {
      this.applyLoadOrder(nextProps.loadOrder);
    }
  }

  public render(): JSX.Element {
    const { t, lootActivity } = this.props;
    const { pluginsCombined } = this.state;

    return (
      <MainPage>
        <MainPage.Body>
          <Layout type='column'>
            <Fixed>
              <h4>{lootActivity}</h4>
            </Fixed>
            <Flex>
              <Table
                tableId='gamebryo-plugins'
                actions={this.actions}
                staticElements={[this.pluginEnabledAttribute, ...this.pluginAttributes]}
                data={pluginsCombined}
              />
            </Flex>
          </Layout>
        </MainPage.Body>
        <MainPage.Overlay>
          <IconBar
            group='gamebryo-plugin-icons'
            staticElements={this.staticButtons}
            buttonType='both'
            orientation='vertical'
          />
        </MainPage.Overlay>
      </MainPage>
    );
  }

  private updatePlugins(plugins: IPlugins) {
    const pluginNames: string[] = Object.keys(plugins);

    const pluginsParsed = {};
    let pluginsLoot;

    Promise.each(pluginNames, (pluginName: string) => {
      return new Promise((resolve, reject) => {
        const esp = new ESPFile(plugins[pluginName].filePath);
        pluginsParsed[pluginName] = {
          isMaster: esp.isMaster,
          description: esp.description,
          author: esp.author,
          masterList: esp.masterList,
        };
        resolve();
      });
    })
      .then(() => {
        return new Promise((resolve, reject) => {
          this.context.api.events.emit('plugin-details',
            pluginNames, (resolved: { [name: string]: IPluginLoot }) => {
              pluginsLoot = resolved;
              resolve();
            });
        });
      })
      .then(() => {
        const pluginsCombined = this.detailedPlugins(plugins, pluginsLoot,
          pluginsParsed);

        this.setState(update(this.state, {
          pluginsParsed: { $set: pluginsParsed },
          pluginsLoot: { $set: pluginsLoot },
          pluginsCombined: { $set: pluginsCombined },
        }));
      });
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

  private modIndices(pluginObjects: ILoadOrder[]): { [pluginId: string]: number } {
    // overly complicated?
    // This sorts the whole plugin list by the load order, inserting the installed
    // native plugins at the top in their hard-coded order. Then it assigns
    // the ascending mod index to all enabled plugins.

    const { nativePlugins } = this.props;
    const installedNative = nativePlugins.filter((name: string) => {
      return pluginObjects.find(
        (plugin: IPluginCombined) => name === plugin.name.toLowerCase()) !== undefined;
    });

    function nativeIdx(name: string): number {
      const idx = installedNative.indexOf(name.toLowerCase());
      return idx !== -1 ? idx : undefined;
    }

    const byLO = pluginObjects.sort((lhs: IPluginCombined, rhs: IPluginCombined) => {
      const lhsLO = lhs.isNative ? nativeIdx(lhs.name) : lhs.loadOrder + 1000;
      const rhsLO = rhs.isNative ? nativeIdx(rhs.name) : rhs.loadOrder + 1000;
      return lhsLO - rhsLO;
    });

    let modIndex = 0;
    const res = {};
    byLO.forEach((plugin: IPluginCombined) => {
      if (plugin.enabled || plugin.isNative) {
        res[plugin.name] = modIndex++;
      } else {
        res[plugin.name] = -1;
      }
    });
    return res;
  }

  private detailedPlugins(plugins: IPlugins,
                          pluginsLoot: { [pluginId: string]: IPluginLoot },
                          pluginsParsed: { [pluginId: string]: IPluginParsed },
                          ): { [id: string]: IPluginCombined } {
    const { loadOrder } = this.props;

    const pluginNames = Object.keys(plugins);

    const pluginObjects: IPluginCombined[] = pluginNames.map((pluginName: string) => {
      return Object.assign({}, {
        name: pluginName,
        modIndex: -1,
        enabled: plugins[pluginName].isNative ? undefined : false,
      }, plugins[pluginName], loadOrder[pluginName],
        pluginsLoot[pluginName], pluginsParsed[pluginName]);
    });

    const modIndices = this.modIndices(pluginObjects);
    const result: { [id: string]: IPluginCombined } = {};
    pluginObjects.forEach((plugin: IPluginCombined) => {
      result[plugin.name] = plugin;
      result[plugin.name].modIndex = modIndices[plugin.name];
    });

    return result;
  }

  private applyLoadOrder(loadOrder: { [pluginId: string]: ILoadOrder }) {
    const { pluginsCombined } = this.state;

    const updateSet = {};
    const pluginsFlat = Object.keys(pluginsCombined).map(pluginId => pluginsCombined[pluginId]);
    pluginsFlat.forEach(plugin => {
      const lo = loadOrder[plugin.name] || {
        enabled: false,
        loadOrder: undefined,
      };
      pluginsFlat[plugin.name] = lo;
      updateSet[plugin.name] = {
        enabled: { $set: lo.enabled },
        loadOrder: { $set: lo.loadOrder },
      };
    });
    const modIndices = this.modIndices(pluginsFlat);
    Object.keys(modIndices).forEach(pluginId => {
      updateSet[pluginId].modIndex = { $set: modIndices[pluginId] };
    });

    this.setState(update(this.state, {
      pluginsCombined: updateSet,
    }));
  }

  private translateLootMessageType(input: string) {
    return {
      say: 'info',
      warn: 'warning',
      error: 'danger',
      unknown: 'warning',
    }[input];
  }

  private renderLootMessages(plugin: IPluginCombined) {
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
      PluginList)) as React.ComponentClass<IBaseProps>;
