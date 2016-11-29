import { ComponentEx, connect, extend, translate } from '../../../util/ComponentEx';

import AttributeToggle from './AttributeToggle';
import * as React from 'react';
import { ControlLabel, FormControl, FormGroup, Jumbotron, Table } from 'react-bootstrap';
import { Fixed, Flex, Layout } from 'react-layout-pane';

import getAttr from '../../../util/getAttr';
import HeaderCell from './HeaderCell';

import { setSavegamelistAttributeSort, setSavegamelistAttributeVisible } from '../actions/session';

import { IStateSavegame } from '../types/IStateSavegame';
import { IStateSavegameSettings } from '../types/IStateSettings';

import { IGameModeSettings } from '../../gamemode_management/types/IStateEx';

import { ISavegame } from '../types/ISavegame';
import { ISavegameAttribute } from '../types/ISavegameAttribute';

// import { setSavegamelistAttributeSort,
  // setSavegamelistAttributeVisible } from '../actions/settings';

import { SortDirection } from '../../../types/SortDirection';
import { IAttributeState } from '../types/IAttributeState';

import { log } from '../../../util/log';
import SavegameRow from './SavegameRow';

interface IProps {
  objects: ISavegameAttribute[];
}

interface IAttributeStateMap {
  [attributeId: string]: IAttributeState;
}

interface IConnectedProps {
  saves: { [saveId: string]: ISavegame };
  savegamelistState: IAttributeStateMap;
  gameMode: string;
  language: string;
}

interface IActionProps {
  onSetAttributeVisible: (attributeId: string, visible: boolean) => void;
  onSetAttributeSort: (attributeId: string, dir: SortDirection) => void;
}

interface IComponentState {
  selectedSavegame: string;
}

/**
 * displays the list of savegames installed for the current game.
 * 
 */
class SavegameList extends ComponentEx<IProps & IConnectedProps & IActionProps, IComponentState> {
  constructor(props) {
    super(props);
    this.state = {
      selectedSavegame: undefined,
    };
  }

  public render(): JSX.Element {
    const { t, objects, savegamelistState, saves, gameMode, language } = this.props;

    const visibleAttributes: ISavegameAttribute[] =
      this.visibleAttributes(objects, savegamelistState);
    let sorted: ISavegame[] =
      this.sortedSavegame(savegamelistState, visibleAttributes, saves, language);

    if (gameMode === undefined) {
      return <Jumbotron>{t('Please select a game first')}</Jumbotron>;
    }

    return (
      <Layout type='column'>
        <Fixed>
          <div className='pull-right'>
            {objects.map(this.renderAttributeToggle)}
          </div>
        </Fixed>
        <Flex>
          <Layout type='row'>
            <Flex>
              <Table bordered condensed hover>
                <thead>
                  <tr>
                    {visibleAttributes.map(this.renderHeaderField)}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((save) => this.renderSavegameRow(save, visibleAttributes))}
                </tbody>
              </Table>
            </Flex>
            <Fixed>
              {this.renderSavegameDetails(this.state.selectedSavegame)}
            </Fixed>
          </Layout>
        </Flex>
      </Layout>
    );
  }

  private standardSort(lhs: any, rhs: any): number {
    return lhs < rhs ? -1
      : lhs === rhs ? 0
        : 1;
  }

  private sortedSavegame(savegamelistState: IAttributeStateMap,
                         attributes: ISavegameAttribute[],
                         saves: { [id: string]: ISavegame },
                         locale: string): ISavegame[] {
    let sortAttribute: ISavegameAttribute = attributes.find((attribute: ISavegameAttribute) => {
      return (savegamelistState[attribute.id] !== undefined)
        && (savegamelistState[attribute.id].sortDirection !== 'none');
    });

    const savegameList: ISavegame[] = Object.keys(saves).map((id: string) => saves[id]);

    if (sortAttribute === undefined) {
      return savegameList;
    }

    let sortFunction = sortAttribute.sortFunc;
    if (sortFunction === undefined) {
      sortFunction = this.standardSort;
    }

    return savegameList.sort((lhs: ISavegame, rhs: ISavegame): number => {
      let res = sortFunction(lhs.attributes[sortAttribute.id],
        rhs.attributes[sortAttribute.id],
        locale);
      if (savegamelistState[sortAttribute.id].sortDirection === 'desc') {
        res *= -1;
      }
      return res;
    });
  }

  private visibleAttributes(attributes: ISavegameAttribute[],
                            attributeStates: IAttributeStateMap): ISavegameAttribute[] {
    return attributes.filter((attribute: ISavegameAttribute) => {
      if (attribute.isDetail) {
        return false;
      } else if (!attributeStates.hasOwnProperty(attribute.id)) {
        return true;
      } else {
        return getAttr(attributeStates[attribute.id], 'enabled', true);
      }
    });
  }

  private renderAttributeToggle = (attr: ISavegameAttribute) => {
    const { t, onSetAttributeVisible, savegamelistState } = this.props;
    return !attr.isToggleable ? null : (
      <AttributeToggle
        key={attr.id}
        attribute={attr}
        state={savegamelistState[attr.id]}
        t={t}
        onSetAttributeVisible={onSetAttributeVisible}
      />
    );
  };

  private renderHeaderField = (attribute: ISavegameAttribute): JSX.Element => {
    let { t, savegamelistState } = this.props;

    if (getAttr(savegamelistState[attribute.id], 'enabled', true)) {
      return (
        <HeaderCell
          key={attribute.id}
          attribute={attribute}
          state={savegamelistState[attribute.id]}
          onSetSortDirection={this.setSortDirection}
          t={t}
        />
      );
    } else {
      return null;
    }
  }

  private setSortDirection = (id: string, direction: SortDirection) => {
    const { savegamelistState, onSetAttributeSort } = this.props;

    // reset all other columns because we can't really support multisort with this ui
    for (let testId of Object.keys(savegamelistState)) {
      if ((id !== testId) && (savegamelistState[testId].sortDirection !== 'none')) {
        onSetAttributeSort(testId, 'none');
      }
    }

    onSetAttributeSort(id, direction);
  }

  private renderSavegameDetails = (saveId: string) => {
    if (saveId === undefined) {
      return null;
    }

    const update = require('react-addons-update');

    const { saves, objects } = this.props;
    const save = saves[saveId];

    if (save === undefined) {
      log('warn', 'unknown save id', saveId);
      this.setState(update(this.state, {
        selectedSavegame: { $set: undefined },
      }));
      return null;
    }

    return (
      <form>
        {objects.map((obj) => this.renderSavegameDetail(save, obj))}
      </form>
    );
  };

  private renderSavegameDetail = (save: ISavegame, attribute: ISavegameAttribute) => {
    const { t } = this.props;
    return (
      <FormGroup key={`${save.id}-${attribute.id}`}>
        <ControlLabel>{attribute.name}</ControlLabel>
        <FormControl
          id={attribute.id}
          type='text'
          label={t(attribute.name)}
          // readOnly={attribute.isReadOnly}
          defaultValue={this.renderCell(attribute.calc(save.attributes))}
        />
      </FormGroup>
    );
  }

  private renderCell(value: any): string {
    const { language } = this.props;

    if (value instanceof Date) {
      return value.toLocaleString(language);
    } else if (typeof (value) === 'string') {
      return value;
    } else if ((value === undefined) || (value === null)) {
      return '';
    } else {
      return value.toString();
    }
  }

  private renderSavegameRow(save: ISavegame, visibleAttributes: ISavegameAttribute[]): JSX.Element {
    let { language } = this.props;
    return (
      <SavegameRow
        key={save.id}
        save={save}
        attributes={visibleAttributes}
        language={language}
      />
    );
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
    saves: IStateSavegameSettings,
  };
  saves: IStateSavegame;
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    saves: state.session.saves.saves,
    savegamelistState: state.session.saves.savegamelistState,
    gameMode: state.settings.gameMode.current,
    language: state.settings.interface.language,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetAttributeVisible: (attributeId: string, visible: boolean) => {
      dispatch(setSavegamelistAttributeVisible(attributeId, visible));
    },
    onSetAttributeSort: (attributeId: string, dir: SortDirection) => {
      dispatch(setSavegamelistAttributeSort(attributeId, dir));
    },
  };
}

function registerSavegameAttribute(instance: SavegameList, attribute: ISavegameAttribute) {
  return attribute;
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      extend(registerSavegameAttribute)(SavegameList)
    )
  ) as React.ComponentClass<{}>;
