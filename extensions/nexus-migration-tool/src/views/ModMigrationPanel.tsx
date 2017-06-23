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
          onClick={this.addSearchPath}
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
            onClick={this.addSearchPath}
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
    const virtualPath = selectedDir;

    this.nextState.importedMod = undefined;

    parseNMMInstall(virtualPath)
    .then((modEntries) => {
      this.importList = modEntries;
      this.nextState.importedMod = modEntries;
    });
  }

  private addSearchPath = (evt) => {
    this.context.api.selectDir({})
    .then((dirName: string) => {
      if (!util.isNullOrWhitespace(dirName)) {
        this.selectedVirtualPath = dirName;
        this.testParse(evt, dirName);
      }
    })
    .catch((err) => {
      log('info', 'search path selection cancelled', { err });
    });
  }

  private startImport = (evt) => {
    this.importMods(evt);
  }

  private importMods = (evt) => {
    const { gameMode } = this.props;
    Promise.map(this.importList, modEntry => {
      transferUnpackedMod(modEntry, this.selectedVirtualPath,
       selectors.installPath(this.state) , true)
      .then((files) => {
        if (files.length > 0) {
          log('info', 'Error: ', {files});
        }
      });
    })
    .then(() => {
      addMods(gameMode, this.importList, this.context.api.store.dispatch);
    })
    .catch((err) => {
      log('info', 'import failed', { err });
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
