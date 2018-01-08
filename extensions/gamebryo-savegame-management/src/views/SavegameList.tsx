import { removeSavegame, showTransferDialog } from '../actions/session';
import { ISavegame } from '../types/ISavegame';
import { mygamesPath, saveFiles } from '../util/gameSupport';
import refreshSavegames from '../util/refreshSavegames';
import restoreSavegamePlugins, { MissingPluginsError } from '../util/restoreSavegamePlugins';
import transferSavegames from '../util/transferSavegames';

import {
  CHARACTER_NAME, CREATION_TIME, FILENAME, LEVEL, LOCATION, PLUGINS,
  SAVEGAME_ID, SCREENSHOT,
} from '../savegameAttributes';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as React from 'react';
import { FormControl, Panel } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';
import * as Redux from 'redux';
import {} from 'redux-thunk';
import {
  actions, ComponentEx, FlexLayout, IconBar, ITableRowAction,
  MainPage, selectors, Spinner, Table, tooltip, types, util,
} from 'vortex-api';

// current typings know neither the function nor the return value
declare const createImageBitmap: (imgData: ImageData) => Promise<any>;

const placeholder: string = '------';

class Dimensions {
  public width: number;
  public height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}

interface IConnectedProps {
  currentProfile: types.IProfile;
  profiles: { [id: string]: types.IProfile };
  saves: { [saveId: string]: ISavegame };
  savesPath: string;
  showTransfer: boolean;
  gameMode: string;
  discoveredGames: { [id: string]: types.IDiscoveryResult };
  saveGameActivity: string;
}

interface IActionProps {
  onRemoveSavegame: (savegameId: string) => void;
  onHideTransfer: () => void;
  onShowDialog: (
    type: types.DialogType,
    title: string,
    content: types.IDialogContent,
    actions: types.DialogActions) => Promise<types.IDialogResult>;
  onShowActivity: (message: string, id?: string) => void;
  onShowError: (message: string, details: any, id?: string) => void;
  onShowSuccess: (message: string, id?: string) => void;
  onDismissNotification: (id: string) => void;
}

interface IComponentState {
  profileId: string;
  importSaves: { [saveId: string]: ISavegame };
}

type Props = IConnectedProps & IActionProps;

/**
 * displays the list of savegames installed for the current game.
 *
 */
class SavegameList extends ComponentEx<Props, IComponentState> {
  private savegameActions: ITableRowAction[];

  constructor(props) {
    super(props);
    this.initState({
      profileId: undefined,
      importSaves: undefined,
    });

    this.savegameActions = [
      {
        icon: 'delete',
        title: props.t('Delete'),
        action: this.remove,
      },
      {
        icon: 'recover',
        title: props.t('Restore savegame\'s plugins'),
        action: this.restore,
        multiRowAction: false,
      },
    ];
  }

  public render(): JSX.Element {
    const { t, saves, saveGameActivity, showTransfer } = this.props;
    const { importSaves, profileId } = this.state;

    let saveActions = this.savegameActions;

    let header: JSX.Element;
    if (showTransfer) {
      header = this.renderTransfer();
      saveActions = [].concat([{
        icon: 'sign-in',
        title: t('Import'),
        action: this.importSaves,
      }], this.savegameActions);
    } else {
      header = (
        <IconBar
          group='savegames-icons'
          orientation='vertical'
          className='menubar'
        />
      );
    }

    let content = null;
    if (!showTransfer || (importSaves !== undefined)) {
      content = (
        <Panel>
          <Table
            tableId='savegames'
            data={showTransfer ? importSaves : saves}
            actions={saveActions}
            staticElements={[
              SCREENSHOT, SAVEGAME_ID, CHARACTER_NAME, LEVEL,
              LOCATION, FILENAME, CREATION_TIME, PLUGINS]}
          />
        </Panel>
      );
    } else {
      content = (profileId === undefined)
        ? <h4>{t('Please select a profile to import from')}</h4>
        : <Spinner />;
    }

    return (
      <MainPage>
        <MainPage.Header>
          {header}
        </MainPage.Header>
        <MainPage.Body>
          {this.renderSavegameActivity()}
          {content}
        </MainPage.Body>
        <MainPage.Overlay>
          <IconBar
            group='savegames-icons'
            orientation='vertical'
          />
        </MainPage.Overlay>
      </MainPage>
    );
  }

  private renderSavegameActivity() {
    const { t, saveGameActivity } = this.props;
    if (saveGameActivity !== undefined) {
      return (
        <FlexLayout.Fixed>
          <div>
            <Spinner />
            {t(saveGameActivity)}
          </div>
        </FlexLayout.Fixed>
      );
    } else {
      return null;
    }

  }

  private renderTransfer() {
    const { t, currentProfile, profiles } = this.props;

    const activeHasLocalSaves = util.getSafe(currentProfile, ['features', 'local_saves'], false);

    const profileOptions = Object.keys(profiles)
      .filter(profileId =>
        // only profiles that use local saves
        util.getSafe(profiles[profileId], ['features', 'local_saves'], false)
        // for the current game
        && (profiles[profileId].gameId === currentProfile.gameId)
        // and don't list the import target itself
        && (profiles[profileId].id !== currentProfile.id));

    return (
      <div style={{ whiteSpace: 'nowrap' }}>
        {t('Import from') + ' '}
        <FormControl
          style={{ display: 'inline-block' }}
          componentClass='select'
          onChange={this.selectProfile}
        >
          <option
            key=''
            value=''
          >
            {placeholder}
          </option>
          {activeHasLocalSaves ? (
            <option
              key='__global'
              value='__global'
            >
              {t('Global')}
            </option>
          ) : null}
          {profileOptions.map(profileId => this.renderProfilesOption(profileId))}
        </FormControl>
        <tooltip.IconButton
          id='btn-transfer-save-cancel'
          tooltip={t('Cancel')}
          icon='remove'
          onClick={this.cancelTransfer}
        />
      </div>
    );
  }

  private renderProfilesOption(profileId: string): JSX.Element {
    const { t, profiles } = this.props;
    const profile = profiles[profileId];
    return (
      <option
        key={profile.id}
        value={profile.id}
      >
        {t('Profile') + ': ' + profile.name}
      </option>
    );
  }

  private cancelTransfer = () => {
    this.props.onHideTransfer();
  }

  private selectProfile = (evt) => {
    let profileId = evt.currentTarget.value;
    if (profileId === '') {
      profileId = undefined;
    }
    this.nextState.profileId = profileId;
    this.loadSaves(profileId);
  }

  private loadSaves(selectedProfileId: string): Promise<void> {
    const { currentProfile, profiles, saves } = this.props;

    if (selectedProfileId === undefined) {
      this.nextState.importSaves = undefined;
      return;
    }

    const savesPath = path.join(mygamesPath(currentProfile.gameId), 'Saves',
      (selectedProfileId === '__global' ? '' : selectedProfileId));

    const newSavegames: ISavegame[] = [];

    this.nextState.importSaves = undefined;

    return refreshSavegames(savesPath, (save: ISavegame): void => {
      newSavegames.push(save);
    })
      .then(() => {
        const savesDict: { [id: string]: ISavegame } = {};
        newSavegames.forEach(save => savesDict[save.id] = save);

        this.nextState.importSaves = savesDict;
        return Promise.resolve();
      });
  }

  private restore = (instanceId: string) => {
    const { t, onDismissNotification, onShowDialog, onShowActivity,
            onShowError, onShowSuccess, saves } = this.props;
    const { discoveredGames, gameMode } = this.props;

    const game = util.getGame(gameMode);
    const modPath = game.getModPaths(discoveredGames[gameMode].path)[''];

    const notificationId = 'restore-plugins-id';
    onShowActivity('Restoring plugins', notificationId);

    restoreSavegamePlugins(this.context.api, modPath, saves[instanceId])
      .then(() => {
        onShowSuccess('Restoring plugins complete', notificationId);
      })
      .catch(MissingPluginsError, (err: MissingPluginsError) => {
        let restorePlugins = true;
        onShowDialog('question', t('Restore plugins'), {
          message: t('Some plugins are missing and can\'t be enabled.\n\n{{missingPlugins}}',
            {
              replace: {
                missingPlugins: err.missingPlugins.join('\n'),
              },
            }),
          options: {
            translated: true,
          },
        }, [{ label: 'Cancel' }, { label: 'Continue' }])
          .then((result: types.IDialogResult) => {
            restorePlugins = result.action === 'Continue';
            if (restorePlugins) {
              this.context.api.events.emit('set-plugin-list', saves[instanceId].attributes.plugins);
              onShowSuccess('Restored plugins for savegame', notificationId);
            } else {
              onDismissNotification(notificationId);
            }
          });
      })
      .catch((err: Error) => {
        onShowError('Failed to restore plugins', 'Restore canceled', notificationId);
      });
  }

  private remove = (instanceIds: string[]) => {
    const { t, currentProfile, onRemoveSavegame, onShowDialog, savesPath } = this.props;

    let doRemoveSavegame = true;

    onShowDialog('question', t('Confirm Deletion'), {
      message: t('Do you really want to remove these files?\n{{saveIds}}',
        { replace: { saveIds: instanceIds.join('\n') } }),
      options: {
        translated: true,
      },
    }, [ { label: 'Cancel' }, { label: 'Delete' } ])
      .then((result: types.IDialogResult) => {
        doRemoveSavegame = result.action === 'Delete';
        if (doRemoveSavegame) {
          return Promise.map(instanceIds, id => !!id
            ? Promise.map(saveFiles(currentProfile.gameId, id), filePath =>
              fs.removeAsync(path.join(mygamesPath(currentProfile.gameId), savesPath, filePath))
                .catch(err => (err.code === 'ENOENT')
                    ? Promise.resolve() : Promise.reject(err))
                .then(() => {
                  onRemoveSavegame(id);
                }))
            : Promise.reject(new Error('invalid savegame id')))
            .then(() => undefined);
        } else {
          return Promise.resolve();
        }
      });
  }

  private importSaves = (instanceIds: string[]) => {
    const { t, currentProfile, onShowDialog, saves, savesPath } = this.props;
    const { importSaves, profileId } = this.state;

    const fileNames = instanceIds.map(id => importSaves[id].attributes['filename']);

    onShowDialog('question', t('Import Savegames'), {
      message: t('The following files will be imported:\n{{saveIds}}\n'
        + 'Do you want to move them or create a copy?',
        { replace: { saveIds: fileNames.join('\n') } }),
      options: {
        translated: true,
      },
    }, [
        { label: 'Cancel' },
        { label: 'Move' },
        { label: 'Copy' },
    ])
      .then((result: types.IDialogResult) => {
        if (result.action === 'Cancel') {
          return;
        }
        const gameId = currentProfile.gameId;
        const sourceSavePath = path.join(
          mygamesPath(gameId), 'Saves', profileId !== '__global' ? profileId : '');

        const activeHasLocalSaves =
          util.getSafe(currentProfile, ['features', 'local_saves'], false);
        const destSavePath = path.join(
          mygamesPath(gameId), 'Saves', activeHasLocalSaves ? currentProfile.id : '');

        return transferSavegames(fileNames, sourceSavePath, destSavePath, result.action === 'Copy');
      })
      .then((failedCopies: string[]) => {
        if ((failedCopies === undefined) || (failedCopies.length === 0)) {
          this.context.api.sendNotification({
            type: 'success',
            message: t('{{ count }} savegame imported', { count: fileNames.length }),
            displayMS: 2000,
          });
        } else {
          this.context.api.showErrorNotification(
            t('Not all savegames could be imported'),
            failedCopies.join('\n'));
        }
      });
  }
}

function mapStateToProps(state: any): IConnectedProps {
  const currentProfile = selectors.activeProfile(state);
  return {
    currentProfile,
    profiles: state.persistent.profiles,
    saves: state.session.saves.saves,
    savesPath: state.session.saves.savegamePath,
    showTransfer: state.session.saves.showDialog,
    discoveredGames: state.settings.gameMode.discovered,
    gameMode: selectors.activeGameId(state),
    saveGameActivity: state.session.saves.saveGameActivity,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onRemoveSavegame: (savegameId: string) => dispatch(removeSavegame(savegameId)),
    onShowDialog: (type, title, content, dialogActions) =>
      dispatch(actions.showDialog(type, title, content, dialogActions)),
    onHideTransfer: () => dispatch(showTransferDialog(false)),
    onShowActivity: (message: string, id?: string) =>
      util.showActivity(dispatch, message, id),
    onShowError: (message: string, details: any, id?: string) =>
      util.showError(dispatch, message, details, false, id),
    onShowSuccess: (message: string, id?: string) =>
      util.showSuccess(dispatch, message, id),
    onDismissNotification: (id: string) => dispatch(actions.dismissNotification(id)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(SavegameList),
  ) as React.ComponentClass<{}>;
