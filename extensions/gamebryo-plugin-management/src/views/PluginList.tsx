import {setPluginEnabled} from '../actions/loadOrder';
import {setPluginlistAttributeSort, setPluginlistAttributeVisible} from '../actions/settings';
import {ILoadOrder} from '../types/ILoadOrder';
import {IPlugin, IPlugins} from '../types/IPlugins';

import ESPFile from 'esptk';
import {ComponentEx, HeaderCell, Icon, IconBar, types} from 'nmm-api';
import * as React from 'react';
import update = require('react-addons-update');
import {Checkbox, ControlLabel, FormControl, FormGroup,
        ListGroup, ListGroupItem, Table} from 'react-bootstrap';
import {translate} from 'react-i18next';
import {Fixed, Flex, Layout} from 'react-layout-pane';
import {connect} from 'react-redux';

interface IPluginParsed {
  isMaster: boolean;
}

interface IBaseProps {
}

interface IConnectedProps {
  plugins: IPlugins;
  loadOrder: { [name: string]: ILoadOrder };
  listState: { [attribute: string]: types.IAttributeState };
  language: string;
}

interface IActionProps {
  onSetAttributeVisible: (attributeId: string, visible: boolean) => void;
  onSetAttributeSort: (attributeId: string, dir: types.SortDirection) => void;
  onSetPluginEnabled: (pluginName: string, enabled: boolean) => void;
}

interface IComponentState {
  selectedPlugin: string;
  pluginsParsed: { [name: string]: IPluginParsed };
}

type IPluginCombined = IPlugin & ILoadOrder & IPluginParsed & {
  name: string,
};

type IProps = IBaseProps & IConnectedProps & IActionProps;

const pluginAttributes: types.ITableAttribute[] = [
  {
    id: 'enabled',
    name: 'Enabled',
    isToggleable: false,
    isReadOnly: false,
    isSortable: false,
    calc: (attributes: any) => attributes.enabled,
  },
  {
    id: 'name',
    name: 'Name',
    isToggleable: false,
    isReadOnly: true,
    isSortable: true,
    calc: (attributes: any) => attributes.name,
  },
  {
    id: 'modName',
    name: 'Mod',
    icon: 'cubes',
    isToggleable: true,
    isReadOnly: true,
    isSortable: true,
    calc: (attributes: any) => attributes.mod,
  },
  {
    id: 'flags',
    name: 'Flags',
    icon: 'flag',
    isToggleable: true,
    isReadOnly: true,
    isSortable: false,
    calc: (attributes: any) => attributes.isMaster ? <Icon name='globe'/> : null,
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
    calc: (attributes: any) => attributes.modIndex,
  },
];

function toHex(num: number) {
  let res = num.toString(16).toUpperCase();
  if (res.length < 2) {
    res = '0' + res;
  }
  return res;
}

function standardSort(lhs: any, rhs: any): number {
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
    };
    this.staticButtons = [];
  }

  public render(): JSX.Element {
    const { plugins } = this.props;

    let sorted: string[] = this.sortedPlugins(Object.keys(plugins));

    return (
      <Layout type='column'>
        <Fixed>
          <IconBar
            group='gamebryo-plugin-icons'
            staticElements={this.staticButtons}
            style={{ width: '100%', display: 'flex' }}
          />
        </Fixed>
        <Flex>
          <Layout type='row'>
            <Flex style={{ height: '100%', overflowY: 'auto' }}>
              <Table bordered condensed hover>
                <thead>
                  <tr>
                    {pluginAttributes.map((attribute) => this.renderHeader(attribute))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(this.renderPlugin)}
                </tbody>
              </Table>
            </Flex>
            <Fixed>
              {this.renderPluginDetails(this.state.selectedPlugin)}
            </Fixed>
          </Layout>
        </Flex>
      </Layout>
    );
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

  private sortedPlugins(pluginNames: string[]): string[] {
    const { plugins, listState, loadOrder, language } = this.props;
    let sortAttribute: types.ITableAttribute =
        pluginAttributes.find((attribute: types.ITableAttribute) => {
            return (listState[attribute.id] !== undefined)
                && (listState[attribute.id].sortDirection !== 'none');
    });

    if (sortAttribute === undefined) {
      return pluginNames;
    }

    let sortFunction = sortAttribute.sortFunc;
    if (sortFunction === undefined) {
      sortFunction = standardSort;
    }

    let pluginObjects: IPluginCombined[] = pluginNames.map((plugin: string) => {
      return Object.assign({}, plugins[plugin], loadOrder[plugin], {
        name: plugin,
        isMaster: false,
      });
    });

    return pluginObjects.sort((lhs: IPluginCombined, rhs: IPluginCombined): number => {
      let res = sortFunction(lhs[sortAttribute.id], rhs[sortAttribute.id], language);

      if (listState[sortAttribute.id].sortDirection === 'desc') {
        res *= -1;
      }
      return res;
    }).map((val: IPluginCombined) => val.name);
  }

  private renderPlugin = (pluginName: string): JSX.Element => {
    const { loadOrder, plugins } = this.props;
    const pluginOrder = loadOrder[pluginName] || {
      enabled: false,
      loadOrder: -1,
      modIndex: -1,
    };

    if (plugins[pluginName] === undefined) {
      return null;
    }

    return (
      <tr
        key={pluginName}
        id={`row-${pluginName}`}
        onClick={this.selectPlugin}
      >
        <td>
          <Checkbox
            id={`checkbox-${pluginName}`}
            checked={pluginOrder.enabled}
            onChange={this.togglePlugin}
          />
        </td>
        <td>
          {pluginName}
        </td>
        <td>
          {plugins[pluginName].modName}
        </td>
        <td>
          {pluginOrder.loadOrder}
        </td>
        <td>
          {pluginOrder.modIndex >= 0 ? toHex(pluginOrder.modIndex) : null}
        </td>
      </tr>
    );
  }

  private selectPlugin = (evt: __React.MouseEvent) => {
    const row = (evt.currentTarget as HTMLTableRowElement);
    this.setState(update(this.state, {
      selectedPlugin: { $set: row.id.split('-').slice(1).join('-') },
    }));
  }

  private togglePlugin = (evt: __React.MouseEvent) => {
    const { loadOrder } = this.props;
    let box = (evt.currentTarget as HTMLInputElement);
    let pluginName = box.id.split('-').slice(1).join('-');
    let lo = loadOrder[pluginName];
    this.props.onSetPluginEnabled(pluginName, (lo === undefined) || !lo.enabled);
  }

  private renderPluginDetails = (pluginName: string) => {
    if (pluginName === undefined) {
      return null;
    }

    const { t, plugins } = this.props;

    let esp = new ESPFile(plugins[pluginName].filePath);

    return (
      <form style={{ minWidth: 300 }}>
        <FormGroup>
          <ControlLabel>{t('Filename')}</ControlLabel>
          <FormControl
            id='ctrl-plugin-filename'
            type='text'
            readOnly={true}
            value={pluginName}
          />
        </FormGroup>
        <FormGroup>
          <ControlLabel>{t('Description')}</ControlLabel>
          <FormControl
            id='ctrl-plugin-description'
            componentClass='textarea'
            readOnly={true}
            value={esp.description}
            rows={6}
          />
          <Checkbox checked={esp.isMaster}>
            { t('Is a master') }
          </Checkbox>
        </FormGroup>
        <FormGroup>
          <ControlLabel>{t('Author')}</ControlLabel>
          <FormControl
            id='ctrl-plugin-author'
            type='text'
            readOnly={true}
            value={esp.author}
          />
        </FormGroup>
        <FormGroup>
          <ControlLabel>{t('Required Masters')}</ControlLabel>
          <ListGroup>
            { esp.masterList.map((master) => <ListGroupItem key={master}>{master}</ListGroupItem>) }
          </ListGroup>
        </FormGroup>
      </form>
    );
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    plugins: state.session.plugins.pluginList,
    loadOrder: state.loadOrder,
    listState: state.settings.plugins.pluginlistState || {},
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
  };
}

export default
  translate(['common', 'gamebryo-plugin'], {wait: false})(
    connect(mapStateToProps, mapDispatchToProps)(
      PluginList
    )
  ) as React.ComponentClass<IBaseProps>;
