import { selectImportFolder } from '../actions/session';
import { IFileEntry, IModEntry } from '../types/nmmEntries';
import { transferArchives, transferUnpackedMod} from '../util/modFileMigration';
import parseNMMInstall from '../util/nmmVirtualConfigParser';
import { addMods, createProfile } from '../util/vortexImports';

import {
  FILENAME, FILES, MOD_ID, MOD_NAME, MOD_VERSION, STATUS,
} from '../importedModAttributes';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import {
  actions, ComponentEx, Icon, IconBar, ITableRowAction, log,
  MainPage, selectors, Table, tooltip, types, util,
} from 'nmm-api';
import * as path from 'path';
import * as React from 'react';
import { FormControl } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { Fixed } from 'react-layout-pane';
import { connect } from 'react-redux';

interface IConnectedProps {
  currentProfile: types.IProfile;
  profiles: { [id: string]: types.IProfile };
  importedMods: IModEntry[];
  gameMode: string;
  discoveredGames: { [id: string]: types.IDiscoveryResult };
  importedModsActivity: string;
}

interface IActionProps {
  onHideTransfer: () => void;
  onShowActivity: (message: string, id?: string) => void;
  onShowError: (message: string, details: any, id?: string) => void;
  onShowSuccess: (message: string, id?: string) => void;
  onDismissNotification: (id: string) => void;
}

interface IComponentState {
  profileId: string;
  importedMod: IModEntry[];
}

type Props = IConnectedProps & IActionProps;

/**
 * displays the list of mods to import from NMM.
 *
 */
class ModMigrationPanel extends ComponentEx<Props, IComponentState> {
  private modActions: ITableRowAction[];
  private importList: IModEntry[];
  private selectedVirtualPath: string;
  private selectionId: string = 'path-selection-id';
  private importId: string = 'vortex-import-id';

  constructor(props) {
    super(props);
    this.initState({
      profileId: undefined,
      importedMod: undefined,
    });

    this.modActions = [
      {
        icon: 'remove',
        title: props.t('Do Not Import'),
        action: this.remove,
      },
      {
        icon: 'copy',
        title: props.t('Import Anyway'),
        action: this.restore,
        multiRowAction: false,
      },
    ];
  }

  public render(): JSX.Element {
    const { t, importedMods } = this.props;
    const { importedMod, profileId } = this.state;
    let actions = this.modActions;
    const selectFolder = true;

    let header: JSX.Element;
    header = this.renderTransfer();
    actions = [].concat(this.modActions);

    let content = null;
    if (!selectFolder || ((importedMod !== undefined) && (importedMod !== null))) {
      content = (
        <Table
          tableId='importedmods'
          data={selectFolder ? importedMod : importedMods}
          actions={actions}
          staticElements={[
            MOD_ID, MOD_NAME, MOD_VERSION, FILENAME, FILES, STATUS]}
        />
      );
    }

    return (
      <MainPage>
        <MainPage.Header>
          {header}
        </MainPage.Header>
        <MainPage.Body>
          {this.renderImportedModsActivity()}
          {content}
        </MainPage.Body>
        <MainPage.Overlay>
          <IconBar
            group='mod-import-icons'
            buttonType='both'
            orientation='vertical'
          />
        </MainPage.Overlay>
      </MainPage>
    );
  }

  private renderImportedModsActivity() {
    const { t, importedModsActivity } = this.props;
    if (importedModsActivity !== undefined) {
      return (
        <Fixed>
          <div>
            <Icon name='spinner' pulse />
            {t(importedModsActivity)}
          </div>
        </Fixed>
      );
    } else {
      return null;
    }
  }

  private renderTransfer() {
    const { t, currentProfile, profiles } = this.props;

    let buttons;

    if ((this.importList !== null) && (this.importList !== undefined)
      && (this.importList.length > 0)) {
      buttons = (
      <div style={{ whiteSpace: 'nowrap' }}>
        {t('Select import folder') + ' '}
        <tooltip.IconButton
          id='btn-test-parse'
          tooltip={t('Select a NMM Virtual folder to parse')}
          icon='export'
          onClick={this.selectVirtualPath}
        />
        <tooltip.IconButton
          id='btn-test-import'
          tooltip={t('Imports the parsed mods')}
          icon='download'
          onClick={this.startImport}
        />
      </div>
      );
    } else {
      buttons = (
        <div style={{ whiteSpace: 'nowrap' }}>
          {t('Select import folder') + ' '}
          <tooltip.IconButton
            id='btn-test-parse'
            tooltip={t('Select a NMM Virtual folder to parse')}
            icon='export'
            onClick={this.selectVirtualPath}
          />
        </div>
      );
    }

    return buttons;
  }

  private cancelTransfer = () => {
    this.props.onHideTransfer();
  }

  private testParse = (evt, selectedDir: string) => {
    const { onShowActivity, onShowError} = this.props;
    const virtualPath = selectedDir;

    this.nextState.importedMod = undefined;

    onShowActivity('Parsing NMM virtual config file...', this.importId);

    parseNMMInstall(virtualPath)
    .then((modEntries) => {
      this.importList = modEntries;
      this.nextState.importedMod = modEntries;
    })
    .catch((err) => {
      onShowError('Virtual config parse issue:', {err}, this.importId);
    });
  }

  private selectVirtualPath = (evt) => {
    const { onShowError, onShowSuccess} = this.props;
    this.context.api.selectDir({})
    .then((dirName: string) => {
      if (!util.isNullOrWhitespace(dirName)) {
        this.selectedVirtualPath = dirName;
        this.testParse(evt, dirName);
      } else {
        onShowSuccess('Virtual path selection cancelled by the user.', this.selectionId);
      }
    })
    .catch((err) => {
      onShowError('Virtual path issue:', {err}, this.selectionId);
    });
  }

  private startImport = (evt) => {
    this.importMods(evt);
  }

  private importMods = (evt) => {
    const { gameMode, onShowActivity, onShowError, onShowSuccess } = this.props;

    onShowActivity('Copying mod files: ' + this.importList.length + ' mods...', this.importId);
    let index: number = 0;

    Promise.map(this.importList, modEntry => {
      onShowActivity('Copying mod files: ' + (++index) +
        ' of ' + this.importList.length + ' mods...', this.importId);
      transferUnpackedMod(modEntry, this.selectedVirtualPath,
       selectors.installPath(this.state) , true)
      .then((files) => {
        if (files.length > 0) {
          log('info', 'Error: ', {files});
          onShowError('Mod files copy error:', {files}, this.importId);
        }
      });
    })
    .then(() => {
      onShowActivity('Importing mods into Vortex...', this.selectionId);
      createProfile(gameMode, 'nmm-profile',
        'Imported NMM Profile', this.context.api.store.dispatch);
      addMods(gameMode, this.importList, this.context.api.store.dispatch);
    })
    .then(() => {
      onShowSuccess('Mod import successfully completed.', this.selectionId);
    })
    .catch((err) => {
      log('info', 'import failed', {err});
      onShowError('Mod import error:', {err}, this.importId);
    });
  }

  private restore = (instanceId: string) => {
    // restores a mod flagged as "do not import" into the import list
  }

  private remove = (instanceIds: string[]) => {
    // removes a mod from the import list
  }
}

function mapStateToProps(state: any): IConnectedProps {
  const currentProfile = selectors.activeProfile(state);
  return {
    currentProfile,
    profiles: state.persistent.profiles,
    importedMods: state.session.modmigration.importedMods,
    gameMode: selectors.activeGameId(state),
    discoveredGames: state.settings.gameMode.discovered,
    importedModsActivity: state.session.modmigration.importedModsActivity,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onHideTransfer: () => dispatch(selectImportFolder(false)),
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
    connect(mapStateToProps, mapDispatchToProps)(ModMigrationPanel),
  ) as React.ComponentClass<{}>;
