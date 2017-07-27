import { selectImportFolder } from '../actions/session';
import { IFileEntry, IModEntry } from '../types/nmmEntries';
import { transferArchives, transferUnpackedMod} from '../util/modFileMigration';
import parseNMMConfigFile from '../util/nmmVirtualConfigParser';
import { addMods, createProfile } from '../util/vortexImports';

import {
  FILENAME, FILES, LOCAL, MOD_ID, MOD_NAME, MOD_VERSION, STATUS,
} from '../importedModAttributes';

import * as Promise from 'bluebird';
import { remote } from 'electron';
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
  onHideMigration: () => void;
  onShowActivity: (message: string, id?: string) => void;
  onShowError: (message: string, details: any, id?: string) => void;
  onShowSuccess: (message: string, id?: string) => void;
  onDismissNotification: (id: string) => void;
}

interface IComponentState {
  profileId: string;
  importedModList: IModEntry[];
}

type Props = IConnectedProps & IActionProps;

/**
 * displays the list of mods to import from NMM.
 *
 */
class ModMigrationPanel extends ComponentEx<Props, IComponentState> {
  private modActions: ITableRowAction[];
  private toImportList: IModEntry[];
  private selectedVirtualPath: string;
  private virtualConfigFilename: string = 'VirtualModConfig.xml';
  private currentLogFolder: string;
  private parsedModsLogFile: string = 'parsedModsLog.json';
  private activityLog: string[];
  private selectionId: string = 'path-selection-id';
  private importId: string = 'vortex-import-id';

  constructor(props) {
    super(props);
    this.initState({
      profileId: undefined,
      importedModList: undefined,
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
    const { gameMode, importedMods, t } = this.props;
    const { importedModList, profileId } = this.state;
    let importActions = this.modActions;
    const selectFolder = true;

    let header: JSX.Element;
    header = this.renderMigration();
    importActions = [].concat(this.modActions);

    let content = null;
    if (!selectFolder || ((importedModList !== undefined) && (importedModList !== null))) {
      content = (
        <Table
          tableId='importedmods'
          data={selectFolder ? importedModList : importedMods}
          actions={importActions}
          staticElements={[
            MOD_ID, MOD_NAME, MOD_VERSION, FILENAME, FILES, LOCAL, STATUS]}
        />
      );
    } else {
      content = (
        <div style={{ whiteSpace: 'nowrap' }}>
          {t('To start the import, click the button to select the NMM VirtualInstall folder' +
           ' where the VirtualModConfig.xml file to import is located.' +
           ' (i.e. E:\\Games\\Nexus Mod Manager\\' + gameMode + '\\Mods\\VirtualInstall)')}
        </div>
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

  private renderMigration() {
    const { t, currentProfile, profiles } = this.props;

    let buttons;

    if ((this.toImportList !== null) && (this.toImportList !== undefined)
      && (this.toImportList.length > 0)) {
      buttons = (
      <div style={{ whiteSpace: 'nowrap' }}>
        {t('Select import folder') + ' '}
        <tooltip.IconButton
          id='btn-test-parse'
          tooltip={t('Select a NMM Virtual folder to parse')}
          icon='export'
          onClick={this.selectVirtualPath}
        />
        {t('Start import') + ' '}
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

  private cancelMigration = () => {
    this.props.onHideMigration();
  }

  private doParse = (evt, selectedDir: string) => {
    const { gameMode, onShowActivity, onShowError, onShowSuccess} = this.props;
    const virtualPath = selectedDir;
    const state: types.IState = this.context.api.store.getState();
    const mods = state.persistent.mods[gameMode] || {};

    this.nextState.importedModList = undefined;

    onShowActivity('Parsing NMM virtual config file...', this.importId);

    parseNMMConfigFile(virtualPath, mods)
    .then((modEntries) => {
      const parsedModEntries: IModEntry[] = modEntries;
      if ((parsedModEntries === null) || (parsedModEntries === undefined)
        || (parsedModEntries.length === 0)) {
        onShowError('Virtual config parse issue:',
        'The selected folder contained no VirtualModConfig.xml file.', this.importId);
      }
      this.toImportList = parsedModEntries;
      this.nextState.importedModList = parsedModEntries;
      onShowSuccess('NMM virtual config file parsed successfully.', this.importId);
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
        this.selectedVirtualPath = path.join(dirName, this.virtualConfigFilename);
        this.doParse(evt, this.selectedVirtualPath);
      }
    })
    .catch((err) => {
      onShowError('Virtual path issue:', {err}, this.selectionId);
    });
  }

  private startImport = (evt) => {
    const date = new Date();
    this.currentLogFolder = path.join(remote.app.getPath('userData'), 'migration-',
      date.getDate.toString() + date.getTime.toString());
    fs.mkdirAsync(this.currentLogFolder)
    .then(() => {
      fs.copyAsync(this.selectedVirtualPath,
        path.join(this.currentLogFolder, this.virtualConfigFilename))
      .then(() => {
        this.importMods(evt);
      });
    });
  }

  private importMods = (evt) => {
    const { gameMode, onShowActivity, onShowError, onShowSuccess } = this.props;
    const state: types.IState = this.context.api.store.getState();
    log ('info', 'Start Import: ', this.toImportList.length);
    onShowActivity('Copying mod files: ' + this.toImportList.length + ' mods...', this.importId);
    let index: number = 0;

    fs.writeFileAsync(path.join(this.currentLogFolder, this.parsedModsLogFile),
      JSON.stringify(this.toImportList))
    .then(() => {
      log ('info', 'Transfer unpacked mods files...');
      const installPath = selectors.installPath(state);
      Promise.map(this.toImportList, modEntry => {
        onShowActivity('Copying mod files: ' + (++index) +
          ' of ' + this.toImportList.length + ' mods...', this.importId);
        transferUnpackedMod(modEntry, this.selectedVirtualPath,
          installPath, true)
        .then((files) => {
          if (files.length > 0) {
            onShowError('Mod files copy error:', {files}, this.importId);
          }
        });
      })
      .then(() => {
        log ('info', 'Unpacked mod files transfer: successfull.');
        onShowActivity('Mod files copy: successfully transferred to Vortex.', this.importId);
        onShowActivity('Importing mods into Vortex...', this.selectionId);
        createProfile(gameMode, 'nmm-profile',
          'Imported NMM Profile', this.context.api.store.dispatch);
        addMods(gameMode, this.toImportList, this.context.api.store.dispatch);
      })
      .then(() => {
        log ('info', 'Mod import: successfull.');
        onShowSuccess('Mod import successfully completed.', this.selectionId);
      })
      .catch((err) => {
        log ('error', 'Mod import error:', {err});
        onShowError('Mod import error:', {err}, this.importId);
      });
    });
  }

  private restore = (instanceId: string) => {
    const { importedModList } = this.state;
    const mod: IModEntry = importedModList[instanceId];

    mod.importFlag = true;
    this.toImportList[instanceId] = mod;
    this.nextState.importedModList = this.toImportList;
  }

  private remove = (instanceId: string) => {
    const { importedModList } = this.state;
    const mod: IModEntry = importedModList[instanceId];

    mod.importFlag = false;
    this.toImportList[instanceId] = mod;
    this.nextState.importedModList = this.toImportList;
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
    onHideMigration: () => dispatch(selectImportFolder(false)),
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
