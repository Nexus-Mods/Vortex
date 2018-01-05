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
import * as I18next from 'i18next';
import * as update from 'immutability-helper';
import {SimpleMessage} from 'loot';
import * as path from 'path';
import * as React from 'react';
import {Alert, ListGroup, ListGroupItem, Panel} from 'react-bootstrap';
import {translate} from 'react-i18next';
import {connect} from 'react-redux';
import {ComponentEx, FlexLayout, IconBar, ITableRowAction, log, MainPage,
        selectors, Table, TableTextFilter, ToolbarIcon,
        types, util} from 'vortex-api';

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

function toHex(input: number) {
  if (input === undefined) {
    return 'FF';
  }
  let res = input.toString(16).toUpperCase();
  if (res.length < 2) {
    res = '0' + res;
  }
  return res;
}

function num(input: number) {
  return input !== undefined && input !== null ? input : -1;
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
      calc: (plugin: IPluginCombined) => {
        if (plugin.eslIndex === undefined) {
          return toHex(plugin.modIndex);
        } else {
          return `${toHex(plugin.modIndex)} (${plugin.eslIndex})`;
        }
      },
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
      calc: plugin => null,
      isToggleable: true,
      edit: {},
      isSortable: false,
    },
    {
      id: 'author',
      name: 'Author',
      description: 'Author of the plugin',
      placement: 'detail',
      calc: (plugin: IPluginCombined) => plugin.author,
      edit: {},
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
        icon: 'checkbox-checked',
        title: 'Enable',
        action: this.enableSelected,
        singleRowAction: false,
      },
      {
        icon: 'checkbox-unchecked',
        title: 'Disable',
        action: this.disableSelected,
        singleRowAction: false,
      },
    ];

    this.pluginEnabledAttribute = {
      id: 'enabled',
      name: 'Status',
      description: 'Is plugin enabled in current profile',
      icon: 'check-o',
      calc: (plugin: IPluginCombined) => plugin.isNative
          ? undefined
          : plugin.enabled === true ? 'Enabled' : 'Disabled',
      placement: 'table',
      isToggleable: false,
      edit: {
        inline: true,
        choices: () => [
          { key: 'enabled', text: 'Enabled' },
          { key: 'disabled', text: 'Disabled' },
        ],
        onChangeValue: (plugin: IPluginCombined, value: any) => {
          if (plugin.isNative) {
            // safeguard so we don't accidentally disable a native plugin
            return;
          }
          if (value === undefined) {
            // toggle
            this.props.onSetPluginEnabled(plugin.name, !plugin.enabled);
          } else {
            this.props.onSetPluginEnabled(plugin.name, value === 'enabled');
          }
        },
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
            icon: autoSort ? 'locked' : 'unlocked',
            text: autoSort ? t('Autosort enabled', { ns: 'gamebryo-plugin' })
                           : t('Autosort disabled', { ns: 'gamebryo-plugin' }),
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
            icon: 'loot-sort',
            text: t('Sort now', { ns: 'gamebryo-plugin' }),
            onClick: () => this.context.api.events.emit('autosort-plugins', true),
          };
        },
      },
    ];
  }

  public emptyPluginParsed(): { [plugin: string]: IPluginParsed } {
    return Object.keys(this.props.plugins).reduce((prev, key) => {
      prev[key] = {
        isMaster: false,
        parseFailed: false,
        masterList: [],
        author: '',
        description: '',
      };
      return prev;
    }, {});
  }

  public emptyPluginLOOT(): { [plugin: string]: IPluginLoot } {
    return Object.keys(this.props.plugins).reduce((prev, key) => {
      prev[key] = {
        messages: [],
        cleanliness: 'clean',
        tags: { added: [], removed: [], userlistModified: false },
      };
      return prev;
    }, {});
  }

  public componentWillMount() {
    const { plugins } = this.props;
    const parsed = this.emptyPluginParsed();
    const loot = this.emptyPluginLOOT();
    const combined = this.detailedPlugins(plugins, loot, parsed);
    this.setState(update(this.state, {
      pluginsParsed: { $set: parsed },
      pluginsLoot: { $set: loot },
      pluginsCombined: { $set: combined },
    }));

    this.updatePlugins(this.props.plugins);
  }

  public componentWillReceiveProps(nextProps: IProps) {
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
        <MainPage.Header>
          <IconBar
            group='gamebryo-plugin-icons'
            staticElements={this.staticButtons}
            className='menubar'
          />
        </MainPage.Header>
        <MainPage.Body>
          <FlexLayout type='column'>
            <FlexLayout.Fixed>
              {lootActivity ? <h4>{lootActivity}</h4> : null}
            </FlexLayout.Fixed>
            <FlexLayout.Flex>
              <Panel>
                <Table
                  tableId='gamebryo-plugins'
                  actions={this.actions}
                  staticElements={[this.pluginEnabledAttribute, ...this.pluginAttributes]}
                  data={pluginsCombined}
                />
              </Panel>
            </FlexLayout.Flex>
          </FlexLayout>
        </MainPage.Body>
        <MainPage.Overlay>
          <IconBar
            group='gamebryo-plugin-icons'
            staticElements={this.staticButtons}
            orientation='vertical'
          />
        </MainPage.Overlay>
      </MainPage>
    );
  }

  private updatePlugins(plugins: IPlugins) {
    const pluginNames: string[] = Object.keys(plugins);

    const pluginsParsed: { [pluginName: string]: IPluginParsed } = {};
    let pluginsLoot;

    return Promise.each(pluginNames, (pluginName: string) =>
      new Promise((resolve, reject) => {
        try {
          const esp = new ESPFile(plugins[pluginName].filePath);
          pluginsParsed[pluginName] = {
            isMaster: esp.isMaster,
            parseFailed: false,
            description: esp.description,
            author: esp.author,
            masterList: esp.masterList,
          };
        } catch (err) {
          // TODO: there is a time window where this is called on a file that
          //   no longer exists. Since the error message reported from the native
          //   lib isn't super informative we can't differentiate yet, so not
          //   treating this as a big problem.
          log('info', 'failed to parse esp',
            { path: plugins[pluginName].filePath, error: err.message });
          pluginsParsed[pluginName] = {
            isMaster: false,
            parseFailed: true,
            description: '',
            author: '',
            masterList: [],
          };
        }
        resolve();
      }))
      .then(() => new Promise((resolve, reject) => {
        this.context.api.events.emit('plugin-details',
          pluginNames, (resolved: { [name: string]: IPluginLoot }) => {
            pluginsLoot = resolved;
            resolve();
          });
      }))
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
    const { loadOrder, onSetPluginEnabled, plugins } = this.props;

    pluginIds.forEach((key: string) => {
      if ((plugins[key] === undefined) || plugins[key].isNative) {
        return;
      }
      if (!util.getSafe(loadOrder, [key, 'enabled'], false)) {
        onSetPluginEnabled(key, true);
      }
    });
  }

  private disableSelected = (pluginIds: string[]) => {
    const { loadOrder, onSetPluginEnabled, plugins } = this.props;

    pluginIds.forEach((key: string) => {
      if ((plugins[key] === undefined) || plugins[key].isNative) {
        return;
      }
      if (util.getSafe<boolean>(loadOrder, [key, 'enabled'], false)) {
        onSetPluginEnabled(key, false);
      }
    });
  }

  private modIndices(pluginObjects: ILoadOrder[]): { [pluginId: string]: {
    modIndex: number, eslIndex?: number } } {
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
    let eslIndex = 0;
    const res = {};
    byLO.forEach((plugin: IPluginCombined) => {
      if (!plugin.enabled && !plugin.isNative) {
        res[plugin.name] = { modIndex: -1 };
      }

      if (path.extname(plugin.name) === '.esl') {
        res[plugin.name] = {
          modIndex: 0xFE,
          eslIndex: eslIndex++,
        };
      } else {
        res[plugin.name] = {
          modIndex: modIndex++,
        };
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

    const pluginObjects: IPluginCombined[] = pluginNames.map((pluginName: string) =>
      ({
        name: pluginName,
        modIndex: -1,
        enabled: plugins[pluginName].isNative ? undefined : false,
        ...plugins[pluginName],
        ...loadOrder[pluginName],
        ...pluginsLoot[pluginName],
        ...pluginsParsed[pluginName],
      }));

    const modIndices = this.modIndices(pluginObjects);
    const result: { [id: string]: IPluginCombined } = {};
    pluginObjects.forEach((plugin: IPluginCombined) => {
      result[plugin.name] = plugin;
      result[plugin.name].modIndex = modIndices[plugin.name].modIndex;
      result[plugin.name].eslIndex = modIndices[plugin.name].eslIndex;
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
      updateSet[pluginId].modIndex = { $set: modIndices[pluginId].modIndex };
      updateSet[pluginId].eslIndex = { $set: modIndices[pluginId].eslIndex };
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
  const profile = selectors.activeProfile(state);
  return {
    gameMode: profile !== undefined ? profile.gameId : undefined,
    plugins: state.session.plugins.pluginList,
    lootActivity: state.session.plugins.lootActivity,
    loadOrder: state.loadOrder,
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
