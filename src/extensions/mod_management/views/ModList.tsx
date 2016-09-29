import { ISettings } from '../../../types/IState';
import { SortDirection } from '../../../types/SortDirection';
import { ComponentEx, connect, extend, translate } from '../../../util/ComponentEx';

import { setModlistAttributeSort, setModlistAttributeVisible } from '../actions/settings';
import { IAttributeState } from '../types/IAttributeState';
import { IMod } from '../types/IMod';
import { IModAttribute } from '../types/IModAttribute';
import { IStateMods } from '../types/IStateMods';
import { IStateSettings } from '../types/IStateSettings';

import AttributeToggle from './AttributeToggle';
import HeaderCell from './HeaderCell';
import InstallArchiveButton from './InstallArchiveButton';
import ModRow from './ModRow';

import * as React from 'react';
import { Jumbotron, Table } from 'react-bootstrap';
import { Fixed, Flex, Layout } from 'react-layout-pane';

interface IProps {
  objects: IModAttribute[];
}

interface IAttributeStateMap {
  [ id: string ]: IAttributeState;
}

interface IConnectedProps {
  mods: { [id: string]: IMod };
  modlistState: IAttributeStateMap;
  gameMode: string;
  language: string;
}

interface IActionProps {
  onSetAttributeVisible: (id: string, visible: boolean) => void;
  onSetAttributeSort: (id: string, dir: SortDirection) => void;
}

function getAttr<T>(state: IAttributeState, key: string, def: T): T {
  if (state === undefined) {
    return def;
  }

  return state[key] !== undefined ? state[key] : def;
}

/**
 * displays the list of mods installed for the current game.
 * 
 */
class ModList extends ComponentEx<IProps & IConnectedProps & IActionProps, {}> {
  constructor(props) {
    super(props);
  }

  public render(): JSX.Element {
    const { t, objects, modlistState, mods, gameMode, language } = this.props;

    const visibleAttributes: IModAttribute[] = this.visibleAttributes(objects, modlistState);
    let sorted: IMod[] = this.sortedMods(modlistState, visibleAttributes, mods, language);

    return gameMode === undefined
      ? <Jumbotron>{ t('Please select a game first') }</Jumbotron>
      : (
        <Layout type='column'>
          <Fixed>
            <div>
              <InstallArchiveButton />
            </div>
            <div className='pull-right'>
              { objects.map( this.renderAttributeToggle ) }
            </div>
          </Fixed>
          <Flex>
            <Table bordered condensed hover>
              <thead>
                <tr>
                  <th>Enabled</th>
                  { visibleAttributes.map(this.renderHeaderField) }
                </tr>
              </thead>
              <tbody>
                { sorted.map((mod) => this.renderModRow(mod, visibleAttributes)) }
              </tbody>
            </Table>
          </Flex>
        </Layout>
      );
  }

  private standardSort(lhs: any, rhs: any): number {
    return lhs < rhs ? -1
      : lhs === rhs  ? 0
      : 1;
  }

  private sortedMods(modlistState: IAttributeStateMap,
                     attributes: IModAttribute[],
                     mods: { [id: string]: IMod },
                     locale: string): IMod[] {
    let sortAttribute: IModAttribute = attributes.find((attribute: IModAttribute) => {
      return (modlistState[attribute.id] !== undefined)
          && (modlistState[attribute.id].sortDirection !== 'none');
    });

    const modList: IMod[] = Object.keys(mods).map((id: string) => mods[id]);

    if (sortAttribute === undefined) {
      return modList;
    }

    let sortFunction = sortAttribute.sortFunc;
    if (sortFunction === undefined) {
      sortFunction = this.standardSort;
    }

    return modList.sort((lhs: IMod, rhs: IMod): number => {
      let res = sortFunction(lhs.attributes[sortAttribute.id],
                             rhs.attributes[sortAttribute.id],
                             locale);
      if (modlistState[sortAttribute.id].sortDirection === 'desc') {
        res *= -1;
      }
      return res;
    });
  }

  private renderAttributeToggle = (attr) => {
    const { t, modlistState, onSetAttributeVisible } = this.props;
    return (
      <AttributeToggle
        key={attr.id}
        attribute={attr}
        state={modlistState[attr.id]}
        t={t}
        onSetAttributeVisible={onSetAttributeVisible}
      />
    );
  };

  private renderModRow(mod: IMod, visibleAttributes: IModAttribute[]): JSX.Element {
    return (
      <ModRow
        key={ mod.id }
        mod={ mod }
        attributes={ visibleAttributes }
      />
    );
  }

  private visibleAttributes(attributes: IModAttribute[],
                            attributeStates: IAttributeStateMap): IModAttribute[] {
    return attributes.filter((attribute: IModAttribute) => {
      if (attribute.isDetail) {
        return false;
      } else {
        return getAttr(attributeStates[attribute.id], 'enabled', true);
      }
    });
  }

  private renderHeaderField = (attribute: IModAttribute): JSX.Element => {
    let { t, modlistState } = this.props;

    if (getAttr(modlistState[attribute.id], 'enabled', true)) {
      return (
        <HeaderCell
          key={attribute.id}
          attribute={attribute}
          state={modlistState[attribute.id]}
          onSetSortDirection={ this.setSortDirection }
          t={t}
        />
      );
    } else {
      return null;
    }
  }

  private setSortDirection = (id: string, direction: SortDirection) => {
    const { modlistState, onSetAttributeSort } = this.props;

    // reset all other columns because we can't really support multisort with this ui
    for (let testId of Object.keys(modlistState)) {
      if ((id !== testId) && (modlistState[testId].sortDirection !== 'none')) {
        onSetAttributeSort(testId, 'none');
      }
    }

    onSetAttributeSort(id, direction);
  }
}

interface IState {
 settings: { base: ISettings,
             interface: {
               language: string
             }
           };
 gameSettings: { mods: IStateSettings };
 mods: IStateMods;
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    mods: state.mods.mods,
    modlistState: state.gameSettings.mods.modlistState,
    gameMode: state.settings.base.gameMode,
    language: state.settings.interface.language,
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onSetAttributeVisible: (id: string, visible: boolean) => {
      dispatch(setModlistAttributeVisible(id, visible));
    },
    onSetAttributeSort: (id: string, dir: SortDirection) => {
      dispatch(setModlistAttributeSort(id, dir));
    },
  };
}

function registerModAttribute(instance: ModList, attribute: IModAttribute) {
  return attribute;
}

export default
  translate(['common'], { wait: true })(
    connect(mapStateToProps, mapDispatchToProps)(
      extend(registerModAttribute)(ModList)
    )
  ) as React.ComponentClass<{}>;
