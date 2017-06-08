import { selectImportFolder } from '../actions/session';
import { IFileEntry, IModEntry } from '../types/nmmEntries';
import parseNMMInstall from '../util/nmmVirtualConfigParser';

import {
  FILENAME, FILES, MOD_ID, MOD_NAME, MOD_VERSION,
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
  selectFolder: boolean;
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
    const { t, importedMods, selectFolder } = this.props;
    const { importedMod, profileId } = this.state;
    let actions = this.modActions;

    let header: JSX.Element;
    if (selectFolder) {
      header = this.renderTransfer();
      actions = [].concat([{
        icon: 'sign-in',
        title: t('Import'),
        action: this.testParse,
      }], this.modActions);
    } else {
      header = (
        <IconBar
          group='mod-import-icons'
          buttonType='icon'
          orientation='vertical'
        />
      );
    }

    let content = null;
    if (!selectFolder || ((importedMod !== undefined) && (importedMod !== null))) {
      content = (
        <Table
          tableId='importedmods'
          data={selectFolder ? importedMod : importedMods}
          actions={actions}
          staticElements={[
            MOD_ID, MOD_NAME, MOD_VERSION, FILENAME, FILES]}
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

    return (
      <div style={{ whiteSpace: 'nowrap' }}>
        {t('Import from') + ' '}
        <tooltip.IconButton
          id='btn-test-import'
          tooltip={t('Parse the hardcoded NMM config file')}
          icon='download'
          onClick={this.testParse}
        />
      </div>
    );
  }

  private cancelTransfer = () => {
    this.props.onHideTransfer();
  }

  private testParse = (evt) => {
    const virtualPath = 'E:\\Games\\Nexus Mod Manager\\SkyrimSE\\Mods\\VirtualInstall';

    this.nextState.importedMod = undefined;

    parseNMMInstall(virtualPath)
    .then((modEntries) => {
      this.nextState.importedMod = modEntries;
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
    selectFolder: state.session.modmigration.selectFolder,
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
