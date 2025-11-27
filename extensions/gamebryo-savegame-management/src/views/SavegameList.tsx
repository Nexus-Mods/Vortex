import { showTransferDialog } from '../actions/session';
import type { ISavegame } from '../types/ISavegame';

import { MAX_SAVEGAMES } from '../constants';
import getSavegameAttributes from '../savegameAttributes';

import Bluebird from 'bluebird';
import * as React from 'react';
import { Alert, FormControl, Panel } from 'react-bootstrap';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import {
  actions, ComponentEx, FlexLayout, IconBar, ITableRowAction,
  MainPage, selectors, Spinner, Table, tooltip, types, util,
} from 'vortex-api';

const placeholder: string = '------';

interface IBaseProps {
  onRefresh: () => void;
  onLoadSaves: (profileId: string) => Promise<ISavegame[]>;
  onRestorePlugins: (savegame: ISavegame) => Promise<void>;
  onRemoveSavegames: (profileId: string, savegameIds: string[]) => Promise<void>;
  onTransferSavegames: (profileId: string, fileNames: string[],
                        keepSource: boolean) => Promise<{ errors: string[], allowReport: boolean }>;
  getInstalledPlugins: () => Promise<string[]>;
}

interface IConnectedProps {
  currentProfile: types.IProfile;
  profiles: { [id: string]: types.IProfile };
  saves: { [saveId: string]: ISavegame };
  savesTruncated: boolean;
  showTransfer: boolean;
  activity: string[];
}

interface IActionProps {
  onHideTransfer: () => void;
  onShowDialog: (
    type: types.DialogType,
    title: string,
    content: types.IDialogContent,
    actions: types.DialogActions) => Bluebird<types.IDialogResult>;
  onShowError: (message: string, details: any, id?: string, allowReport?: boolean) => void;
}

interface IComponentState {
  importProfileId: string;
  importSaves: { [saveId: string]: ISavegame };
}

type Props = IBaseProps & IConnectedProps & IActionProps;

/**
 * displays the list of savegames installed for the current game.
 *
 */
class SavegameList extends ComponentEx<Props, IComponentState> {
  private savegameActions: ITableRowAction[];
  private mTransferAttributes: types.ITableAttribute[] = [];
  private mCurrentProfileAttributes: types.ITableAttribute[] = [];

  constructor(props) {
    super(props);
    this.initState({
      importProfileId: undefined,
      importSaves: undefined,
    });

    this.savegameActions = [
      {
        icon: 'delete',
        title: 'Delete',
        action: this.remove,
      },
      {
        icon: 'recover',
        title: 'Restore Save Game Plugins',
        action: this.restore,
        multiRowAction: false,
      },
    ];
  }

  public UNSAFE_componentWillMount() {
    this.mTransferAttributes = getSavegameAttributes(
      this.context.api, false,
      () => this.props.showTransfer ? this.state.importSaves : this.props.saves,
      this.props.getInstalledPlugins);
    this.mCurrentProfileAttributes = getSavegameAttributes(
      this.context.api, true,
      () => this.props.showTransfer ? this.state.importSaves : this.props.saves,
      this.props.getInstalledPlugins);
  }

  public UNSAFE_componentWillReceiveProps(newProps: Props) {
    if (this.props.showTransfer !== newProps.showTransfer) {
      this.nextState.importProfileId = undefined;
    }

    const { importProfileId } = this.state;
    if ((importProfileId !== undefined)
        && (importProfileId !== '__global')
        && (newProps.profiles[importProfileId] === undefined)) {
      this.nextState.importSaves = {};
      this.nextState.importProfileId = undefined;
    }
  }

  public render(): JSX.Element {
    const { t, activity, showTransfer } = this.props;

    let saveActions = this.savegameActions;

    let header: JSX.Element;
    if (showTransfer) {
      header = this.renderTransfer();
      saveActions = [].concat([{
        icon: 'transfer',
        title: t('Import'),
        action: this.importSaves,
      }], this.savegameActions);
    } else {
      header = (
        <IconBar
          group='savegames-icons'
          orientation='vertical'
          className='menubar'
          t={t}
        />
      );
    }

    return (
      <MainPage>
        <MainPage.Header>
          {header}
        </MainPage.Header>
        <MainPage.Body>
          {this.renderContent(saveActions)}
          {activity.length > 0 ? this.renderBusy() : null}
        </MainPage.Body>
      </MainPage>
    );
  }

  private renderContent(saveActions: ITableRowAction[]) {
    const { t, savesTruncated, showTransfer, saves } = this.props;
    const { importSaves, importProfileId } = this.state;

    let content = null;
    if (!showTransfer || (importSaves !== undefined)) {
      const PanelX: any = Panel;
      content = (
        <Panel>
          <PanelX.Body>
            <FlexLayout type='column'>
              {savesTruncated && !showTransfer ? (
                <FlexLayout.Fixed>
                  <Alert>
                    {t('For performance reasons only the {{count}} most recent '
                      + 'save games were loaded.', { replace: { count: MAX_SAVEGAMES } })}
                  </Alert>
                </FlexLayout.Fixed>
              ) : null}
              <FlexLayout.Flex>
                <Table
                  tableId='savegames'
                  data={showTransfer ? importSaves : saves}
                  actions={saveActions}
                  staticElements={showTransfer
                    ? this.mTransferAttributes
                    : this.mCurrentProfileAttributes}
                />
              </FlexLayout.Flex>
            </FlexLayout>
          </PanelX.Body>
        </Panel>
      );
    } else {
      content = (importProfileId === undefined)
        ? <h4>{t('Please select a profile to import from')}</h4>
        : <Spinner />;
    }
    return content;
  }

  private renderBusy() {
    const { t, activity } = this.props;
    if (activity.length > 0) {
      const PanelX: any = Panel;
      return (
        <div className='savegames-busy-panel'>
          <Spinner />
          {t(activity[0])}
        </div>
      );
    } else {
      return null;
    }

  }

  private renderTransfer() {
    const { t, currentProfile, profiles } = this.props;

    if (currentProfile === undefined) {
      return null;
    }

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
          icon='input-cancel'
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
    // Transfer has been cancelled, revert all
    //  transfer related state information.
    const { currentProfile } = this.props;
    this.nextState.importProfileId = currentProfile.id;
    this.nextState.importSaves = undefined;
    this.props.onHideTransfer();
    this.props.onRefresh();
  }

  private selectProfile = (evt) => {
    let profileId = evt.currentTarget.value;
    if (profileId === '') {
      profileId = undefined;
    }
    this.nextState.importProfileId = profileId;
    this.loadSaves(profileId);
  }

  private loadSaves(selectedProfileId: string): Promise<void> {
    const { onLoadSaves } = this.props;

    this.nextState.importSaves = undefined;

    return onLoadSaves(selectedProfileId)
      .then((newSavegames: ISavegame[]) => {
        const savesDict: { [id: string]: ISavegame } = {};
        newSavegames.forEach(save => savesDict[save.id] = save);

        this.nextState.importSaves = savesDict;
        return Promise.resolve();
      })
      .catch(err => {
        this.nextState.importSaves = {};
        this.props.onShowError('Failed to load savegames',
                               err, undefined,
                               ['ENOENT', 'ENOTFOUND'].indexOf(err.code) === -1);
      });
  }

  private restore = (instanceId: string) => {
    const { onRestorePlugins, saves } = this.props;

    if (saves[instanceId] === undefined) {
      return;
    }

    onRestorePlugins(saves[instanceId]);
  }

  private remove = (instanceIds: string[]) => {
    const { t, onRemoveSavegames, onShowDialog } = this.props;
    const { importProfileId } = this.state;
    let doRemoveSavegame = true;

    onShowDialog('question', t('Confirm Deletion'), {
      text: t('Do you really want to remove these files?'),
      message: instanceIds.join('\n'),
      options: {
        translated: true,
      },
    }, [ { label: 'Cancel' }, { label: 'Delete' } ])
      .then((result: types.IDialogResult) => {
        doRemoveSavegame = result.action === 'Delete';
        if (doRemoveSavegame) {
          return onRemoveSavegames(importProfileId, instanceIds);
        } else {
          return Promise.resolve();
        }
      });
  }

  // Should be called to immediately refresh the importSaves object
  private refreshImportSaves() {
    const { onShowError } = this.props;
    const { importSaves, importProfileId } = this.state;

    if (importProfileId === undefined) {
      return Promise.resolve();
    }

    this.props.onLoadSaves(importProfileId)
      .then(saves => {
        const savesDict: { [id: string]: ISavegame } = {};
        saves.forEach(save => savesDict[save.id] = save);
        if (importSaves !== savesDict) {
          this.nextState.importSaves = savesDict;
        }
        return Promise.resolve();
      })
      .catch(err => onShowError('Unable to refresh import save list', err));
  }

  private importSaves = (instanceIds: string[]) => {
    const { t, currentProfile, onShowDialog, onTransferSavegames } = this.props;
    const { importSaves, importProfileId } = this.state;

    const fileNames = instanceIds.map(id => importSaves[id].attributes['filename']);

    if ((importProfileId === currentProfile.id) || (importProfileId === undefined)) {
      return;
    }

    let userCancelled: boolean = false;
    onShowDialog('question', t('Import Savegames'), {
      text: t('The following files will be imported'),
      message: fileNames.join('\n'),
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
          userCancelled = true;
          return;
        }

        return onTransferSavegames(importProfileId, fileNames, result.action === 'Copy');
      })
      .then((result: { errors: string[], allowReport: boolean }) => {
        if (result === undefined) {
          return;
        }

        const { errors, allowReport } = result;
        this.refreshImportSaves();
        if (userCancelled) {
          this.context.api.sendNotification({
            type: 'info',
            message: t('Savegame transfer cancelled'),
            displayMS: 2000,
          });
        } else if ((errors === undefined) || (errors.length === 0)) {
          this.context.api.sendNotification({
            type: 'success',
            message: t('{{ count }} savegame imported', { count: fileNames.length }),
            displayMS: 2000,
          });
        } else {
          this.context.api.showErrorNotification(
            t('Not all savegames could be imported'),
            errors.join('\n'), { allowReport });
        }
      })
      .catch(err => {
        if (!(err instanceof util.ProcessCanceled)) {
          this.context.api.showErrorNotification('Failed to import savegames', err);
        }
      });
  }
}

const emptyArray = [];

function mapStateToProps(state: any): IConnectedProps {
  const currentProfile = selectors.activeProfile(state);
  return {
    currentProfile,
    profiles: state.persistent.profiles,
    saves: state.session.saves.saves,
    savesTruncated: state.session.saves.savesTruncated,
    showTransfer: state.session.saves.showDialog,
    activity: state.session.base.activity['savegames'] || emptyArray,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onShowDialog: (type, title, content, dialogActions) =>
      dispatch(actions.showDialog(type, title, content, dialogActions)),
    onHideTransfer: () => dispatch(showTransferDialog(false)),
    onShowError: (message: string, details: any, id?: string, allowReport?: boolean) =>
      util.showError(dispatch, message, details, { id, allowReport }),
  };
}

export default
  withTranslation(['common', 'gamebryo-savegames'])(
    connect(mapStateToProps, mapDispatchToProps)(SavegameList) as any,
  ) as React.ComponentClass<{}>;
