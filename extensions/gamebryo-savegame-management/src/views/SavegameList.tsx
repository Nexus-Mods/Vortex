import { setSavegamelistAttributeSort, setSavegamelistAttributeVisible } from '../actions/settings';
import { IAttributeState } from '../types/IAttributeState';
import { ISavegame } from '../types/ISavegame';
import { ISavegameAttribute } from '../types/ISavegameAttribute';

import AttributeToggle from './AttributeToggle';
import HeaderCell from './HeaderCell';
import SavegameRow from './SavegameRow';

import * as fs from 'fs-extra-promise';
import { ComponentEx, log, types, util } from 'nmm-api';
import * as path from 'path';
import * as React from 'react';
import update = require('react-addons-update');
import {
  ControlLabel, FormControl, FormGroup, Jumbotron, Table,
} from 'react-bootstrap';
import {translate} from 'react-i18next';
import { Fixed, Flex, Layout } from 'react-layout-pane';
import {connect} from 'react-redux';

// current typings know neither the function nor the return value
declare var createImageBitmap: (imgData: ImageData) => Promise<any>;

class Dimensions {
  public width: number;
  public height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}

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
  discoveredGames: { [id: string]: types.IDiscoveryResult };
}

interface IActionProps {
  onSetAttributeVisible: (attributeId: string, visible: boolean) => void;
  onSetAttributeSort: (attributeId: string, dir: types.SortDirection) => void;
}

interface IComponentState {
  selectedSavegame: string;
}

type Props = IProps & IConnectedProps & IActionProps;

/**
 * displays the list of savegames installed for the current game.
 * 
 */
class SavegameList extends ComponentEx<Props, IComponentState> {
  public screenshotCanvas: HTMLCanvasElement;
  private refHandlers = {
    canvas: (ref) => {
      this.screenshotCanvas = ref;
      this.forceUpdate();
    },
  };

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
            <Flex style={{ height: '100%', overflowY: 'auto' }}>
              <Table bordered condensed hover>
                <thead>
                  <tr>
                    {visibleAttributes.map(this.renderHeaderField)}
                    <th>{t('Actions')}</th>
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
        return util.getSafe(attributeStates, [attribute.id, 'enabled'], true);
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

    if (util.getSafe(savegamelistState, [attribute.id, 'enabled'], true)) {
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

  private setSortDirection = (id: string, direction: types.SortDirection) => {
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

    const { saves, objects } = this.props;
    const save = saves[saveId];

    if (save === undefined) {
      log('warn', 'unknown savegame id', saveId);
      this.setState(update(this.state, {
        selectedSavegame: { $set: undefined },
      }));
      return null;
    }

    return (
      <div>
        <canvas id='canvas' ref={this.refHandlers.canvas} width='0' height='0' />
        <form style={{ minWidth: 300 }}>
          {objects.map((obj) => this.renderSavegameDetail(save, obj))}
        </form>
      </div>
    );
  };

  private renderSavegameDetail = (save: ISavegame, attribute: ISavegameAttribute) => {
    const { t } = this.props;

    if (this.screenshotCanvas === undefined) {
      return null;
    }

    // TODO: if-elseif-else cascade... This code could probably be nicer. somehow...
    if (attribute.id === 'screenshot') {
      let dim: Dimensions = attribute.calc(save.attributes);
      this.screenshotCanvas.setAttribute('width', dim.width.toString());
      this.screenshotCanvas.setAttribute('height', dim.height.toString());

      try {
        let ctx: CanvasRenderingContext2D = this.screenshotCanvas.getContext('2d');
        let imgData: ImageData = ctx.createImageData(this.screenshotCanvas.width,
          this.screenshotCanvas.height);
        save.savegameBind.screenshot(imgData.data);
        createImageBitmap(imgData)
        .then((bitmap) => {
          // technically we could apply filters here, resize the output and such
          ctx.drawImage(bitmap, 0, 0);
        });
      } catch (err) {
        this.screenshotCanvas.setAttribute('width', '0');
        this.screenshotCanvas.setAttribute('height', '0');
        log('error', 'Error creating ImageData', err.message);
      }

    } else if (attribute.id === 'plugins') {
      let plugins: string[] = attribute.calc(save.attributes);
      return (
        <FormGroup controlId='multiplePlugins' key={`${save.id}-${attribute.id}`}>
          <ControlLabel>{t('Plugins')}</ControlLabel>
          <FormControl componentClass='select' multiple size={20}>
            {plugins.map(this.renderPlugin)}
          </FormControl>
        </FormGroup>
      );
    } else {
      if (attribute.isDetail === true) {
        return (
          <FormGroup key={`${save.id}-${attribute.id}`}>
            <ControlLabel>{attribute.name}</ControlLabel>
            <FormControl
              id={attribute.id}
              type='text'
              label={t(attribute.name)}
              readOnly={attribute.isReadOnly}
              defaultValue={this.renderCell(attribute.calc(save.attributes))}
            />
          </FormGroup>
        );
      }
    }
  }

  private renderPlugin = (searchPlugin: string, index: number) => {
    const { discoveredGames, gameMode } = this.props;
    const discovery = discoveredGames[gameMode];
    let pluginPath = path.join(discovery.modPath, searchPlugin);

    if (fs.existsSync(pluginPath)) {
      return (
        <option value='select' style={{ color: 'black' }} key={index}>{searchPlugin}</option>
      );
    } else {
      return (
        <option value='select' style={{ color: 'red' }} key={index}>{searchPlugin}</option>
      );
    }
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

  private selectSavegame = (evt: React.MouseEvent<any>) => {
    const cell = (evt.target as HTMLTableCellElement);
    const row = (cell.parentNode as HTMLTableRowElement);
    this.setState(update(this.state, {
      selectedSavegame: { $set: row.id },
    }));
  };

  private renderSavegameRow(save: ISavegame, visibleAttributes: ISavegameAttribute[]): JSX.Element {
    let { t, language } = this.props;
    return (
      <SavegameRow
        key={save.id}
        save={save}
        attributes={visibleAttributes}
        language={language}
        onClick={this.selectSavegame}
        selected={save.id === this.state.selectedSavegame}
        t={t}
      />
    );
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    saves: state.session.saves.saves,
    savegamelistState: state.settings.savegamelistState,
    gameMode: state.settings.gameMode.current,
    language: state.settings.interface.language,
    discoveredGames: state.settings.gameMode.discovered,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetAttributeVisible: (attributeId: string, visible: boolean) => {
      dispatch(setSavegamelistAttributeVisible(attributeId, visible));
    },
    onSetAttributeSort: (attributeId: string, dir: types.SortDirection) => {
      dispatch(setSavegamelistAttributeSort(attributeId, dir));
    },
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(SavegameList)
  ) as React.ComponentClass<{}>;
