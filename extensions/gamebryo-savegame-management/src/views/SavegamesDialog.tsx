import {
  selectAllSavegames, setProfileSavegames, setSavegames,
  setSelectedProfile, showSavegamesDialog,
} from '../actions/session';
import { ISavegame } from '../types/ISavegame';
import { gameSupported, iniPath, mygamesPath } from '../util/gameSupport';
import refreshSavegames from '../util/refreshSavegames';
import exportSavegameFile from '../util/savegameManager';

import * as fs from 'fs-extra-promise';
import { ComponentEx, selectors, Table, tooltip, types, util } from 'nmm-api';
import IniParser, { IniFile, WinapiFormat } from 'parse-ini';
import * as path from 'path';
import * as React from 'react';
import { ControlLabel, FormControl, FormGroup, InputGroup, Modal } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';

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
  profileSaves: { [saveId: string]: ISavegame };
  selectAllSavegames: boolean;
  savegamePath: string;
  selectedProfile: types.IProfile;
}

interface IActionProps {
  onShowSelf: (show: boolean) => void;
  onSelectAllSavegames: (selectAll: boolean) => void;
  onSetProfileSavegames: (saves: { [saveId: string]: ISavegame }) => void;
  onSetSelectedProfile: (selectedProfile: types.IProfile) => void;
}

type IProps = IConnectedProps & IActionProps;

class SavegamesDialog extends ComponentEx<IProps, {}> {
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
    const { gameMode, profile, profiles, savegamePath } = this.props;
    return (
      <div>
        <ControlLabel>Profiles</ControlLabel>
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

  private renderSavegames = (evt) => {
    const { gameMode, profiles, profileSaves, saves, savegamePath } = this.props;

    if (evt !== null) {
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
        <ControlLabel>Savegames</ControlLabel>
        <InputGroup>
          <FormControl componentClass='select' multiple style={{ minHeight: 96, minWidth: '100%' }}>
            {Object.keys(profileSaves).map((key) => {
              return this.renderSavegameOptions(profileSaves[key]);
            })}
          </FormControl>
          {this.renderSavegamesButtons(profileSaves)}
        </InputGroup>
      </div>
    );
  }

  private updateSaves(selectedProfileId: string): Promise<string[]> {
    const { gameMode, profiles, saves } = this.props;
    return parser.read(iniPath(gameMode))
      .then((iniFile: IniFile<any>) => {

        const localPath = `Saves/${selectedProfileId}`;

        if (selectedProfileId !== 'GLOBAL') {
          iniFile.data.General.SLocalSavePath = localPath;
        } else {
          iniFile.data.General.SLocalSavePath = 'Saves\\';
        }

        if (!gameSupported(gameMode)) {
          return;
        }

        const readPath = mygamesPath(gameMode) + '\\' +
          iniFile.data.General.SLocalSavePath;

        return fs.ensureDirAsync(readPath)
          .then(() => Promise.resolve(readPath));
      })
      .then((readPath: string) => {
        const newSavegames: ISavegame[] = [];
        return refreshSavegames(readPath, (save: ISavegame): void => {
          if (saves[save.id] === undefined) {
            newSavegames.push(save);
          }
        }).then((failedReads: string[]) => Promise.resolve({ newSavegames, failedReads }));
      })
      .then((result: { newSavegames: ISavegame[], failedReads: string[] }) => {
        const savesDict: { [id: string]: ISavegame } = {};
        result.newSavegames.forEach(
          (save: ISavegame) => { savesDict[save.id] = save; });

        this.props.onSetProfileSavegames(savesDict);
        return Promise.resolve(result.failedReads);
      });
  }

  private renderSavegamesButtons = (profileSaves: { [saveId: string]: ISavegame }) => {
    const { selectAllSavegames, t } = this.props;
    if (Object.keys(profileSaves).length > 0) {
      return (
        <InputGroup.Button>
          <div>
            <tooltip.IconButton
              id='btn-copy-savegames'
              icon='clone'
              tooltip={t('Import selection (copy)')}
              onClick={this.moveSavegames}
              value={'copy'}
            />
          </div>
          <div>
            <tooltip.IconButton
              id='btn-move-savegames'
              icon='exchange'
              tooltip={t('Import selection (move)')}
              onClick={this.moveSavegames}
              value={'move'}
            />
          </div>
          <div>
            <tooltip.IconButton
              id='btn-select-all-savegames'
              icon={selectAllSavegames ? 'compress' : 'expand'}
              tooltip={t('Select all savegames')}
              onClick={this.selectAllSavegames}
            />
          </div>
        </InputGroup.Button>

      );
    } else {
      return null;
    }
  }

  private selectAllSavegames = () => {
    const { selectAllSavegames } = this.props;
    this.props.onSelectAllSavegames(!selectAllSavegames);
  }

  private moveSavegames = (evt) => {
    const { gameMode, profile, savegamePath, selectedProfile } = this.props;
    const action = evt.target.value;
    const sourceSavePath = path.join(mygamesPath(selectedProfile !== undefined ?
      selectedProfile.gameId : gameMode), savegamePath);
    const destSavePath = path.join(mygamesPath(profile.gameId),
      savegamePath, profile.id);

    /*console.log(sourceSavePath);
    console.log(destSavePath);*/

    // exportSavegameFile(sourceSavePath, destSavePath, action === 'move' ? false : true);
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

  private renderSavegameOptions(save: ISavegame): JSX.Element {
    const { selectAllSavegames } = this.props;
    return (
      <option
        key={save.id}
        value={save.id}
        selected={selectAllSavegames}
      >
        {save.id}
      </option>
    );
  }

  private hide = () => {
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
    selectAllSavegames: state.session.saves.selectAllSavegames,
    savegamePath: state.session.saves.savegamePath,
    selectedProfile: state.session.saves.selectedProfile,
    profileSaves: state.session.saves.profileSaves,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onShowSelf: (show: boolean) =>
      dispatch(showSavegamesDialog(show)),
    onSelectAllSavegames: (selectAll: boolean) =>
      dispatch(selectAllSavegames(selectAll)),
    onSetProfileSavegames: (saves: { [saveId: string]: ISavegame }) =>
      dispatch(setProfileSavegames(saves)),
    onSetSelectedProfile: (selectedProfile: types.IProfile) =>
      dispatch(setSelectedProfile(selectedProfile)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(SavegamesDialog),
  ) as React.ComponentClass<{}>;
