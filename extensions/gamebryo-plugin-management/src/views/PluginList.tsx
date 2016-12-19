import {setPluginEnabled, setPluginOrder} from '../actions/loadOrder';
import {
  setAutoSortEnabled,
  setPluginlistAttributeSort,
  setPluginlistAttributeVisible} from '../actions/settings';
import {ILoadOrder} from '../types/ILoadOrder';
import {
  IPluginCombined,
  IPluginLoot,
  IPluginParsed,
  IPlugins,
} from '../types/IPlugins';

import PluginFlags from './PluginFlags';

import * as Promise from 'bluebird';
import ESPFile from 'esptk';
import {SimpleMessage} from 'loot';
import {ComponentEx, HeaderCell, IconBar, log, tooltip, types, util} from 'nmm-api';
import * as React from 'react';
import update = require('react-addons-update');
import {Alert, Checkbox, ControlLabel, FormControl, FormGroup,
        ListGroup, ListGroupItem, Table} from 'react-bootstrap';
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
  language: string;
  lootActivity: string;
}

interface IActionProps {
  onSetAttributeVisible: (attributeId: string, visible: boolean) => void;
  onSetAttributeSort: (attributeId: string, dir: types.SortDirection) => void;
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

const pluginAttributes: types.ITableAttribute[] = [
  {
    id: 'name',
    name: 'Name',
    isToggleable: false,
    isReadOnly: true,
    isSortable: true,
    calc: (attributes: any) => attributes.name,
  },
  {
    id: 'flags',
    name: 'Flags',
    icon: 'flag',
    isToggleable: true,
    isReadOnly: true,
    isSortable: false,
    calc: (attributes: any) => <PluginFlags plugin={attributes} />,
  },
  {
    id: 'loadOrder',
    name: 'Load Order',
    icon: 'sort-numeric-asc',
    isToggleable: true,
    isReadOnly: true,
    isSortable: true,
    calc: (attributes: any) => attributes.loadOrder,
  },
  {
    id: 'modIndex',
    name: 'Mod Index',
    icon: 'indent',
    isToggleable: true,
    isReadOnly: true,
    isSortable: true,
    calc: (attributes: any) => toHex(attributes.modIndex),
  },
];

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

function standardSort(lhs: any, rhs: any): number {
  if (lhs === undefined) {
    return -1;
  } else if (rhs === undefined) {
    return 1;
  }
  return lhs < rhs ? -1
      : lhs === rhs ? 0
          : 1;
}

class PluginList extends ComponentEx<IProps, IComponentState> {
  private staticButtons: types.IIconDefinition[];

  constructor(props) {
    super(props);
    this.state = {
      selectedPlugin: undefined,
      pluginsParsed: {},
      pluginsLoot: {},
    };
    const {t, onSetAutoSortEnabled} = props;
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
      }
    ];
  }

  public componentWillMount() {
    const { plugins } = this.props;

    let pluginNames: string[] = Object.keys(plugins);
    this.context.api.events.emit('plugin-details',
      pluginNames, (resolved: { [name: string]: IPluginLoot }) => {
        this.setState(util.setSafe(this.state, ['pluginsLoot'], resolved));
    });

    Promise.each(pluginNames, (pluginName: string) => {
      let esp = new ESPFile(plugins[pluginName].filePath);
      return new Promise((resolve, reject) => {
        this.setState(util.setSafe(this.state, ['pluginsParsed', pluginName], {
          isMaster: esp.isMaster,
          description: esp.description,
          author: esp.author,
          masterList: esp.masterList,
        }), () => resolve());
      });
    });
  }

  public render(): JSX.Element {
    const { t, plugins, listState, lootActivity } = this.props;
    const { selectedPlugin } = this.state;

    const visibleAttributes: types.ITableAttribute[] =
      this.visibleAttributes(pluginAttributes, listState);
    let sorted: IPluginCombined[] = this.sortedPlugins(Object.keys(plugins));

    let selected: IPluginCombined = selectedPlugin === undefined ? undefined :
      sorted.find((plugin: IPluginCombined) => plugin.name === selectedPlugin);

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
          <Layout type='row'>
            <Flex style={{ height: '100%', overflowY: 'auto' }}>
              <Table bordered condensed hover>
                <thead>
                  <tr>
                    <th>{t('Enabled')}</th>
                    {visibleAttributes.map((attribute) => this.renderHeader(attribute))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((plugin) => this.renderPlugin(plugin, visibleAttributes))}
                </tbody>
              </Table>
            </Flex>
            <Fixed style={{ height: '100%', overflowY: 'auto' }}>
              {this.renderPluginDetails(selected)}
            </Fixed>
          </Layout>
        </Flex>
      </Layout>
    );
  }

  private visibleAttributes(attributes: types.ITableAttribute[],
                            attributeStates: IAttributeStateMap): types.ITableAttribute[] {
    return attributes.filter((attribute: types.ITableAttribute) => {
      if (!attributeStates.hasOwnProperty(attribute.id)) {
        return true;
      } else {
        return util.getSafe(attributeStates, [attribute.id, 'enabled'], true);
      }
    });
  }

  private renderHeader = (attribute: types.ITableAttribute) => {
    const { t, listState } = this.props;
    const defaultState: types.IAttributeState = {
      enabled: true,
      sortDirection: 'none',
    };
    return (
      <HeaderCell
        key={attribute.id}
        attribute={attribute}
        state={listState[attribute.id] || defaultState}
        t={t}
        onSetSortDirection={this.setSortDirection}
      />
    );
  }

  private setSortDirection = (id: string, direction: types.SortDirection) => {
    const { listState, onSetAttributeSort } = this.props;

    // reset all other columns because we can't really support multisort with this ui
    for (let testId of Object.keys(listState)) {
      if ((id !== testId) && (listState[testId].sortDirection !== 'none')) {
        onSetAttributeSort(testId, 'none');
      }
    }

    onSetAttributeSort(id, direction);
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

  private sortedPlugins(pluginNames: string[]): IPluginCombined[] {
    const { plugins, listState, loadOrder, language } = this.props;
    const {pluginsLoot, pluginsParsed} = this.state;
    let sortAttribute: types.ITableAttribute =
        pluginAttributes.find((attribute: types.ITableAttribute) => {
            return (listState[attribute.id] !== undefined)
                && (listState[attribute.id].sortDirection !== 'none');
    });

    let sortFunction;
    if ((sortAttribute === undefined) || (sortAttribute.sortFunc === undefined)) {
      sortFunction = standardSort;
    } else {
      sortFunction = sortAttribute.sortFunc;
    }

    let pluginObjects: IPluginCombined[] = pluginNames.map((pluginName: string) => {
      return Object.assign({}, plugins[pluginName], loadOrder[pluginName],
        pluginsLoot[pluginName], pluginsParsed[pluginName], {
        name: pluginName,
        modIndex: -1,
      });
    });

    this.updateModIndex(pluginObjects);

    if (sortAttribute === undefined) {
      return pluginObjects;
    }

    return pluginObjects.sort((lhs: IPluginCombined, rhs: IPluginCombined): number => {
      let res = sortFunction(lhs[sortAttribute.id], rhs[sortAttribute.id], language);

      if (listState[sortAttribute.id].sortDirection === 'desc') {
        res *= -1;
      }
      return res;
    });
  }

  private renderPlugin = (plugin: IPluginCombined,
                          visibleAttributes: types.ITableAttribute[]): JSX.Element => {
    return (
      <tr
        key={plugin.name}
        id={`row-${plugin.name}`}
        onClick={this.selectPlugin}
      >
        <td>
          <Checkbox
            id={`checkbox-${plugin.name}`}
            checked={plugin.enabled || plugin.isNative}
            disabled={plugin.isNative}
            onChange={this.togglePlugin}
          />
        </td>
        {visibleAttributes.map((attribute) => this.renderAttribute(attribute, plugin))}
      </tr>
    );
  }

  private renderAttribute = (attribute: types.ITableAttribute, plugin: IPluginCombined) => {
    return <td key={`td-${plugin.name}-${attribute.id}`}>{attribute.calc(plugin)}</td>;
  }

  private selectPlugin = (evt: React.MouseEvent<any>) => {
    const row = (evt.currentTarget as HTMLTableRowElement);
    this.setState(update(this.state, {
      selectedPlugin: { $set: row.id.split('-').slice(1).join('-') },
    }));
  }

  private togglePlugin = (evt: React.MouseEvent<any>) => {
    const { loadOrder } = this.props;
    let box = (evt.currentTarget as HTMLInputElement);
    let pluginName = box.id.split('-').slice(1).join('-');
    let lo = loadOrder[pluginName];
    this.props.onSetPluginEnabled(pluginName, (lo === undefined) || !lo.enabled);
  }

  private renderPluginDetails = (plugin: IPluginCombined) => {
    const { t } = this.props;

    if (plugin === undefined) {
      return null;
    }

    return (
      <form style={{ minWidth: 300 }}>
        <FormGroup>
          <ControlLabel>{t('Filename')}</ControlLabel>
          <FormControl
            id='ctrl-plugin-filename'
            type='text'
            readOnly={true}
            value={plugin.name}
          />
        </FormGroup>
        <FormGroup>
          <ControlLabel>{t('Description')}</ControlLabel>
          <FormControl
            id='ctrl-plugin-description'
            componentClass='textarea'
            readOnly={true}
            value={plugin.description}
            rows={6}
          />
          <Checkbox checked={plugin.isMaster} readOnly={true}>
            { t('Is a master') }
          </Checkbox>
        </FormGroup>
        <FormGroup>
          <ControlLabel>{t('Author')}</ControlLabel>
          <FormControl
            id='ctrl-plugin-author'
            type='text'
            readOnly={true}
            value={plugin.author}
          />
        </FormGroup>
        <FormGroup>
          <ControlLabel>{t('Required Masters')}</ControlLabel>
          { this.renderMasterList(plugin) }
        </FormGroup>
        <FormGroup>
          <ControlLabel>{t('Messages (LOOT)')}</ControlLabel>
          { this.renderLootMessages(plugin) }
        </FormGroup>
      </form>
    );
  }

  private renderMasterList = (plugin: IPluginCombined) => {
    if (plugin.masterList === undefined) {
      return null;
    }

    return (
      <ListGroup>
        {plugin.masterList.map((m) => <ListGroupItem key={m}>{m}</ListGroupItem>)}
      </ListGroup>
    );
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
    gameMode: state.settings.gameMode.current,
    plugins: state.session.plugins.pluginList,
    lootActivity: state.session.plugins.lootActivity,
    loadOrder: state.loadOrder,
    listState: state.settings.plugins.pluginlistState || {},
    autoSort: state.settings.plugins.autoSort,
    language: state.settings.interface.language,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetPluginEnabled: (pluginName: string, enabled: boolean) =>
      dispatch(setPluginEnabled(pluginName, enabled)),
    onSetAttributeVisible: (attributeId: string, visible: boolean) => {
      dispatch(setPluginlistAttributeVisible(attributeId, visible));
    },
    onSetAttributeSort: (attributeId: string, dir: types.SortDirection) => {
      dispatch(setPluginlistAttributeSort(attributeId, dir));
    },
    onSetAutoSortEnabled: (enabled: boolean) => {
      dispatch(setAutoSortEnabled(enabled));
    },
    onSetPluginOrder: (newOrder: string[]) => {
      dispatch(setPluginOrder(newOrder));
    }
  };
}

export default
  translate(['common', 'gamebryo-plugin'], {wait: false})(
    connect(mapStateToProps, mapDispatchToProps)(
      PluginList
    )
  ) as React.ComponentClass<IBaseProps>;
