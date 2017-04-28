import {
  setSavegames, setSelectAllSavegames,
  setSelectedProfile, showSavegamesDialog,
} from '../actions/session';
import { CHARACTER_NAME, FILENAME } from '../savegameAttributes';
import { ISavegame, ISelectedSave } from '../types/ISavegame';
import { gameSupported, iniPath, mygamesPath } from '../util/gameSupport';
import refreshSavegames from '../util/refreshSavegames';
import exportSavegameFile from '../util/savegameFileManager';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { actions, ComponentEx, selectors, tooltip, types, util } from 'nmm-api';
import IniParser, { IniFile, WinapiFormat } from 'parse-ini';
import * as path from 'path';
import * as React from 'react';
import {
  Button, Checkbox, ControlLabel, FormControl, FormGroup,
  InputGroup, Modal, Table,
} from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';
import update = require('react-addons-update');
import { Flex } from 'react-layout-pane';

const parser = new IniParser(new WinapiFormat());

interface IProfileInfo {
  gameId: string;
  profileId: string;
}

interface IConnectedProps {
  showDialog: boolean;
  gameMode: string;
  profiles: { [id: string]: types.IProfile };
  profile: types.IProfile;
  saves: { [saveId: string]: ISavegame };
  savegamePath: string;
  selectedProfile: types.IProfile;
  selectAllSavegames: boolean;
}

interface IActionProps {
  onShowSelf: (show: boolean) => void;
  onSelectAllSavegames: (selectAllSavegames: boolean) => void;
  onSetSelectedProfile: (selectedProfile: types.IProfile) => void;
  onShowError: (message: string, details?: string | Error) => void;
}

interface IComponentState {
  selectedSavegames: ISelectedSave[];
  profileSaves: { [saveId: string]: ISavegame };
  characters: string[];
}

type IProps = IConnectedProps & IActionProps;

class SavegamesDialog extends ComponentEx<IProps, IComponentState> {

  constructor(props) {
    super(props);
    this.state = {
      selectedSavegames: [],
      profileSaves: {},
      characters: [],
    };
  }

  public componentWillMount(): void {
    this.props.onSelectAllSavegames(false);
  }

  public render(): JSX.Element {
    const { t, showDialog } = this.props;

    return (
      <Modal show={showDialog} onHide={this.hide}>
        <Modal.Header>
          <h4>{t('Transfer Savegames')}</h4>
        </Modal.Header>
        <Modal.Body>
          <FormGroup controlId='transfer-savegames'>
            {this.renderProfiles()}
            {this.renderSavegames(null)}
          </FormGroup>
        </Modal.Body>
      </Modal>
    );
  }

  private renderProfiles = () => {
    const { gameMode, profile, profiles, t } = this.props;
    return (
      <div>
        <ControlLabel>{t('Profiles')}</ControlLabel>
        <FormControl componentClass='select' multiple>
          <option
            id='GLOBAL'
            key='GLOBAL'
            onClick={this.renderSavegames}
            value='GLOBAL'
          >
            GLOBAL
          </option>
          {Object.keys(profiles).map((key) => {
            const localSaves = util.getSafe(profiles[key], ['features', 'local_saves'], false);
            if (profiles[key].gameId === gameMode &&
              profiles[key].id !== profile.id &&
              localSaves) {
              return this.renderProfilesOptions(profiles[key]);
            } else {
              return null;
            }
          })}
        </FormControl>
      </div>
    );
  }

  private updateSaves(selectedProfileId: string): Promise<string[]> {
    const { gameMode, profiles, saves } = this.props;
    return parser.read(iniPath(gameMode))
      .then((iniFile: IniFile<any>) => {

        const localPath = `Saves/${selectedProfileId}/`;

        if (selectedProfileId !== 'GLOBAL') {
          iniFile.data.General.SLocalSavePath = localPath;
        } else {
          iniFile.data.General.SLocalSavePath = 'Saves\\';
        }

        if (!gameSupported(gameMode)) {
          return;
        }

        const readPath = path.join(mygamesPath(gameMode),
          iniFile.data.General.SLocalSavePath);

        return fs.ensureDirAsync(readPath)
          .then(() => Promise.resolve(readPath));
      })
      .then((readPath: string) => {
        const newSavegames: ISavegame[] = [];
        return refreshSavegames(readPath, (save: ISavegame): void => {
          newSavegames.push(save);
        }).then((failedReads: string[]) => Promise.resolve({ newSavegames, failedReads }));
      })
      .then((result: { newSavegames: ISavegame[], failedReads: string[] }) => {
        const savesDict: { [id: string]: ISavegame } = {};
        const characters: string[] = [];
        result.newSavegames.forEach(
          (save: ISavegame) => {

            if (characters.indexOf(save.attributes['name']) === -1) {
              characters.push(save.attributes['name']);
            }
            return savesDict[save.id] = save;
          });

        this.setState(update(this.state, { characters: { $set: characters } }));
        this.setState(update(this.state, { profileSaves: { $set: savesDict } }));
        return Promise.resolve(result.failedReads);
      });
  }

  private renderSavegames = (evt) => {
    const { gameMode, profiles,
      saves, selectAllSavegames, t } = this.props;
    const { profileSaves } = this.state;

    if (evt !== null) {
      this.setState(update(this.state, { selectedSavegames: { $set: [] } }));
      this.props.onSelectAllSavegames(false);
      const selectedProfileId = evt.target.id;

      this.updateSaves(selectedProfileId);

      if (selectedProfileId !== 'GLOBAL') {
        this.props.onSetSelectedProfile(profiles[selectedProfileId]);
      } else {
        this.props.onSetSelectedProfile(undefined);
      }
    }

    return (
      <div>
        <ControlLabel>{t('Savegames')}</ControlLabel>
        <Flex style={{ height: 400, overflowY: 'auto' }} >
          <InputGroup style={{ width: '100%', maxHeight: 300 }}>
            <Table bordered>
              <thead>
                <tr>
                  <th>
                    <tooltip.IconButton
                      className='btn-embed'
                      id='btn-select-all-savegames'
                      icon={selectAllSavegames ? 'check-square-o' : 'square-o'}
                      tooltip={!selectAllSavegames ?
                        t('Check all savegames') : t('Uncheck all savegames')}
                      onClick={this.selectAllSavegames}
                    />
                  </th>
                  <th>{t('CHARACTER')}</th>
                  <th>{t('FILENAME')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(profileSaves).map((key) => {
                  return this.renderTableBody(profileSaves[key]);
                })}
              </tbody>
            </Table>
          </InputGroup>
        </Flex>
        {this.renderSavegamesButtons(profileSaves)}
      </div>
    );
  }

  private renderTableBody(save: ISavegame): JSX.Element {
    const { characters, selectedSavegames } = this.state;

    const selected: ISelectedSave = selectedSavegames.find((selectedSavegame) =>
      selectedSavegame.saveGameId === save.id);

    return (
      <tr key={save.id}>
        <td style={{ textAlign: 'center' }}>
          <Checkbox
            id={save.id}
            onChange={this.saveSelected}
            checked={selected !== undefined ? selected.enable : false}
          />
        </td>
        <td>{save.attributes['name']}</td>
        <td>{save.attributes['filename']}</td>
      </tr>
    );
  }

  private saveSelected = (evt) => {
    const { selectedSavegames } = this.state;

    const selected: ISelectedSave = selectedSavegames.find((save) =>
      save.saveGameId === evt.target.id);

    if (selected === undefined) {
      const save: ISelectedSave = {
        saveGameId: evt.target.id,
        enable: true,
      };
      selectedSavegames.push(save);
    } else {
      selectedSavegames.splice(selectedSavegames.indexOf(selected), 1);
    }

    this.setState(update(this.state, { selectedSavegames: { $set: selectedSavegames } }));
  }

  private renderSavegamesButtons = (profileSaves: { [saveId: string]: ISavegame }) => {
    const { t } = this.props;
    const { characters } = this.state;
    if (Object.keys(profileSaves).length > 0) {
      return (
        <InputGroup.Button>
          <div>
            <tooltip.Button
              id='btn-copy-savegames'
              tooltip={t('Import selection (copy)')}
              onClick={this.moveSavegames}
              value={'copying'}
            >
              {t('COPY')}
            </tooltip.Button>
            <tooltip.Button
              id='btn-move-savegames'
              tooltip={t('Import selection (move)')}
              onClick={this.moveSavegames}
              value={'moving'}
            >
              {t('MOVE')}
            </tooltip.Button>
          </div>
          <div>
            <FormControl
              componentClass='select'
              onChange={this.selectChar}
            >
              <option key='' value=''>
                -----
              </option>
              {characters.map((char) => this.renderChar(char))};
            </FormControl>
          </div>
        </InputGroup.Button>

      );
    } else {
      return null;
    }
  }

  private renderChar = (char: string) => {
    return (
      <option key={char} value={char}>
        {char}
      </option>
    );
  }

  private selectChar = (evt) => {
    const { profileSaves, selectedSavegames } = this.state;

    const saves: ISelectedSave[] = [];

    this.setState(update(this.state, { selectedSavegames: { $set: saves } }));

    if (evt.target.value !== '') {
      Object.keys(profileSaves).map((key) => {

        if (profileSaves[key].attributes['name'] === evt.target.value) {
          const save: ISelectedSave = {
            saveGameId: profileSaves[key].id,
            enable: true,
          };
          saves.push(save);
        }
      });

      this.setState(update(this.state, { selectedSavegames: { $set: saves } }));
    }
  }

  private selectAllSavegames = (evt) => {
    const { selectAllSavegames } = this.props;
    const { profileSaves, selectedSavegames } = this.state;

    const saves: ISelectedSave[] = [];

    this.setState(update(this.state, { selectedSavegames: { $set: saves } }));

    if (selectAllSavegames === false) {
      Object.keys(profileSaves).map((key) => {
        const save: ISelectedSave = {
          saveGameId: profileSaves[key].id,
          enable: !selectAllSavegames,
        };
        saves.push(save);
      });
      this.setState(update(this.state, { selectedSavegames: { $set: saves } }));
    }

    this.props.onSelectAllSavegames(!selectAllSavegames);
  }

  private moveSavegames = (evt) => {
    const { gameMode, profile,
      profiles, savegamePath, selectedProfile } = this.props;
    const { profileSaves, selectedSavegames } = this.state;
    const action = evt.target.value;

    const sourceSavePath = path.join(mygamesPath(profile.gameId), 'Saves\\',
      selectedProfile !== undefined ? selectedProfile.id : '');

    const destSavePath = path.join(mygamesPath(selectedProfile !== undefined ?
      selectedProfile.gameId : gameMode), savegamePath);

    exportSavegameFile(selectedSavegames, sourceSavePath,
      destSavePath, action === 'moving' ? false : true)
      .then((failedCopies: string[]) => {

        if (failedCopies.length > 0) {
          const files = failedCopies.join('\n');
          this.props.onShowError('An error occurred ' + action + ' these files: \n' + files);
        }
        this.setState(update(this.state, { selectedSavegames: { $set: [] } }));
        this.updateSaves(selectedProfile !== undefined ? selectedProfile.id : 'GLOBAL');
      });
  }

  private renderProfilesOptions(profile: types.IProfile): JSX.Element {
    return (
      <option
        id={profile.id}
        key={profile.id}
        onClick={this.renderSavegames}
        value={profile.gameId}
      >
        {'Game: ' + profile.gameId + ' Profile: ' + profile.name}
      </option>
    );
  }

  private hide = () => {
    this.props.onSetSelectedProfile(undefined);
    this.props.onSelectAllSavegames(false);
    this.setState(update(this.state, { selectedSavegames: { $set: [] } }));
    this.props.onShowSelf(false);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  const gameMode = selectors.activeGameId(state);
  const profile = selectors.activeProfile(state);
  return {
    showDialog: state.session.saves.showDialog,
    gameMode,
    profiles: state.persistent.profiles,
    profile,
    saves: state.session.saves.saves,
    savegamePath: state.session.saves.savegamePath,
    selectedProfile: state.session.saves.selectedProfile,
    selectAllSavegames: state.session.saves.selectAllSavegames,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onShowSelf: (show: boolean) =>
      dispatch(showSavegamesDialog(show)),
    onSelectAllSavegames: (selectAllSavegames: boolean) =>
      dispatch(setSelectAllSavegames(selectAllSavegames)),
    onSetSelectedProfile: (selectedProfile: types.IProfile) =>
      dispatch(setSelectedProfile(selectedProfile)),
    onShowError: (message: string, details?: string | Error) =>
      util.showError(dispatch, message, details),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(SavegamesDialog),
  ) as React.ComponentClass<{}>;
