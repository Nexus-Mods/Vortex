import { SortDirection } from '../../../types/SortDirection';
import { ComponentEx, connect, extend, translate } from '../../../util/ComponentEx';
import getAttr from '../../../util/getAttr';

import { IGameModeSettings } from '../../gamemode_management/types/IStateEx';

import { setModEnabled } from '../../profile_management/actions/profiles';
import { IProfile, IProfileMod } from '../../profile_management/types/IProfile';
import { IProfileSettings } from '../../profile_management/types/IStateEx';

import { setModlistAttributeSort, setModlistAttributeVisible } from '../actions/settings';
import { IAttributeState } from '../types/IAttributeState';
import { IMod } from '../types/IMod';
import { IModAttribute } from '../types/IModAttribute';
import { IStateMods } from '../types/IStateMods';
import { IStateModSettings } from '../types/IStateSettings';

import AttributeToggle from './AttributeToggle';
import HeaderCell from './HeaderCell';
import InstallArchiveButton from './InstallArchiveButton';
import ModRow from './ModRow';

import * as React from 'react';
import { ControlLabel, FormControl, FormGroup, Jumbotron, Table } from 'react-bootstrap';
import { Fixed, Flex, Layout } from 'react-layout-pane';
import update = require('react-addons-update');

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

interface IComponentState {
  selectedMod: string;
}

/**
 * displays the list of mods installed for the current game.
 * 
 */
class ModList extends ComponentEx<IProps & IConnectedProps & IActionProps, IComponentState> {
  constructor(props) {
    super(props);
    this.state = {
      selectedMod: undefined,
    };
  }

  public render(): JSX.Element {
    const { t, objects, modlistState, mods, gameMode, language } = this.props;

    const visibleAttributes: IModAttribute[] = this.visibleAttributes(objects, modlistState);
    let sorted: IMod[] = this.sortedMods(modlistState, visibleAttributes, mods, language);

    if (gameMode === undefined) {
      return <Jumbotron>{ t('Please select a game first') }</Jumbotron>;
    }

    return (
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
          <Layout type='row'>
            <Flex style={{ height: '100%', overflowY: 'auto' }} >
              <Table bordered condensed hover>
                <thead>
                  <tr>
                    <th>{t('Enabled')}</th>
                    {visibleAttributes.map(this.renderHeaderField)}
                    <th>{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((mod) => this.renderModRow(mod, visibleAttributes))}
                </tbody>
              </Table>
              </Flex>
                <Fixed>
                  {this.renderModDetails(this.state.selectedMod)}
                </Fixed>
            </Layout>
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

  private renderCell(value: any): string {
    const { language } = this.props;

    if (value instanceof Date) {
      return value.toLocaleString(language);
    } else if (typeof(value) === 'string') {
      return value;
    } else if ((value === undefined) || (value === null)) {
      return '';
    } else {
      return value.toString();
    }
  }

  private renderModDetail = (mod: IMod, attribute: IModAttribute) => {
    const { t } = this.props;
    return (
      <FormGroup key={`${mod.id}-${attribute.id}`}>
        <ControlLabel>{attribute.name}</ControlLabel>
        <FormControl
          id={attribute.id}
          type='text'
          label={t(attribute.name)}
          readOnly={attribute.isReadOnly}
          defaultValue={this.renderCell(attribute.calc(mod.attributes))}
        />
      </FormGroup>
    );
  }

  private renderModDetails = (modId: string) => {
    if (modId === undefined) {
      return null;
    }

    const { mods, objects } = this.props;
    const mod = mods[modId];

    if (mod === undefined) {
      log('warn', 'unknown mod id', modId);
      this.setState(update(this.state, {
        selectedMod: { $set: undefined },
      }));
      return null;
    }

    return (
      <form style={{ minWidth: 300 }}>
      {objects.map((obj) => this.renderModDetail(mod, obj))}
      </form>
    );
  };

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

  private selectMod = (evt: __React.MouseEvent) => {
    const cell = (evt.target as HTMLTableCellElement);
    const row = (cell.parentNode as HTMLTableRowElement);
    this.setState(update(this.state, {
      selectedMod: { $set: row.id },
    }));
  };

  private renderModRow(mod: IMod, visibleAttributes: IModAttribute[]): JSX.Element {
    let { language, modState, onSetModEnabled } = this.props;
    return (
      <ModRow
        key={mod.id}
        mod={mod}
        modState={modState[mod.id]}
        attributes={visibleAttributes}
        language={language}
        onSetModEnabled={onSetModEnabled}
        onClick={this.selectMod}
        selected={mod.id === this.state.selectedMod}
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
    gameMode: IGameModeSettings
    interface: {
      language: string
    }
  };
  gameSettings: {
    mods: IStateModSettings,
    profiles: IProfileSettings,
  };
  mods: IStateMods;
}

function mapStateToProps(state: IState): IConnectedProps {
  const activeProfile: IProfile =
    state.gameSettings.profiles.profiles[state.gameSettings.profiles.currentProfile];

  return {
    mods: state.mods.mods,
    modState: activeProfile !== undefined ? activeProfile.modState : {},
    modlistState: state.gameSettings.mods.modlistState,
    gameMode: state.settings.gameMode.current,
    language: state.settings.interface.language,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
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
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      extend(registerModAttribute)(ModList)
    )
  ) as React.ComponentClass<{}>;
