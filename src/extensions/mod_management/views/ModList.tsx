import { setModEnabled } from '../../../actions/profiles';

import { IProfileMod } from '../../../types/IProfile';
import { IGameSettingsProfiles, ISettings } from '../../../types/IState';
import { SortDirection } from '../../../types/SortDirection';
import { ComponentEx, connect, extend, translate } from '../../../util/ComponentEx';

import { setModlistAttributeSort, setModlistAttributeVisible } from '../actions/settings';
import { IAttributeState } from '../types/IAttributeState';
import { IMod } from '../types/IMod';
import { IModAttribute } from '../types/IModAttribute';
import { IStateMods } from '../types/IStateMods';
import { IStateModSettings } from '../types/IStateSettings';
import getAttr from '../util/getAttr';

import AttributeToggle from './AttributeToggle';
import HeaderCell from './HeaderCell';
import InstallArchiveButton from './InstallArchiveButton';
import ModRow from './ModRow';

import * as React from 'react';
import { Jumbotron, Table } from 'react-bootstrap';
import { Fixed, Flex, Layout } from 'react-layout-pane';

import { log } from '../../../util/log';

interface IProps {
  objects: IModAttribute[];
}

interface IAttributeStateMap {
  [ attributeId: string ]: IAttributeState;
}

interface IConnectedProps {
  mods: { [modId: string]: IMod };
  modState: { [modId: string]: IProfileMod };
  modlistState: IAttributeStateMap;
  gameMode: string;
  language: string;
}

interface IActionProps {
  onSetAttributeVisible: (attributeId: string, visible: boolean) => void;
  onSetAttributeSort: (attributeId: string, dir: SortDirection) => void;
  onSetModEnabled: (modId: string, enabled: boolean) => void;
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

  private renderAttributeToggle = (attr: IModAttribute) => {
    const { t, modlistState, onSetAttributeVisible } = this.props;
    return !attr.isToggleable ? null : (
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
    let { modState, onSetModEnabled } = this.props;
    return (
      <ModRow
        key={ mod.id }
        mod={ mod }
        modState={ modState[mod.id] }
        attributes={ visibleAttributes }
        onSetModEnabled={ onSetModEnabled }
      />
    );
  }

  private visibleAttributes(attributes: IModAttribute[],
                            attributeStates: IAttributeStateMap): IModAttribute[] {
    return attributes.filter((attribute: IModAttribute) => {
      if (attribute.isDetail) {
        return false;
      } else if (!attributeStates.hasOwnProperty(attribute.id)) {
        return true;
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
  settings: {
    base: ISettings,
    interface: {
      language: string
    }
  };
  gameSettings: {
    mods: IStateModSettings,
    profiles: IGameSettingsProfiles,
  };
  mods: IStateMods;
}

function mapStateToProps(state: IState): IConnectedProps {
  const activeProfile =
    state.gameSettings.profiles.profiles[state.gameSettings.profiles.currentProfile];

  return {
    mods: state.mods.mods,
    modState: activeProfile.modState,
    modlistState: state.gameSettings.mods.modlistState,
    gameMode: state.settings.base.gameMode,
    language: state.settings.interface.language,
  };
}

function mapDispatchToProps(dispatch): IActionProps {
  return {
    onSetAttributeVisible: (attributeId: string, visible: boolean) => {
      dispatch(setModlistAttributeVisible(attributeId, visible));
    },
    onSetAttributeSort: (attributeId: string, dir: SortDirection) => {
      dispatch(setModlistAttributeSort(attributeId, dir));
    },
    onSetModEnabled: (modId: string, enabled: boolean) => {
      dispatch(setModEnabled(modId, enabled));
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
