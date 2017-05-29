import { showDialog } from '../../../actions/notifications';
import { IActionDefinition } from '../../../types/IActionDefinition';
import { IAttributeState } from '../../../types/IAttributeState';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../../types/IDialog';
import { IState } from '../../../types/IState';
import { ITableAttribute } from '../../../types/ITableAttribute';
import { ComponentEx, connect, extend, translate } from '../../../util/ComponentEx';
import { activeGameId, activeProfile } from '../../../util/selectors';
import { getSafe, setSafe } from '../../../util/storeHelper';
import IconBar from '../../../views/IconBar';
import MainPage from '../../../views/MainPage';
import SuperTable, { ITableRowAction } from '../../../views/Table';
import TextFilter from '../../../views/table/TextFilter';
import { IconButton } from '../../../views/TooltipControls';

import { IDownload } from '../../download_management/types/IDownload';
import { setModEnabled } from '../../profile_management/actions/profiles';
import { IProfileMod } from '../../profile_management/types/IProfile';

import { removeMod, setModAttribute } from '../actions/mods';
import { IMod } from '../types/IMod';
import { IModProps } from '../types/IModProps';
import filterModInfo from '../util/filterModInfo';
import groupMods from '../util/modGrouping';
import modName from '../util/modName';
import modUpdateState, { UpdateState } from '../util/modUpdateState';
import resolvePath from '../util/resolvePath';
import VersionChangelogButton from '../views/VersionChangelogButton';
import VersionIconButton from '../views/VersionIconButton';

import { INSTALL_TIME, PICTURE } from '../modAttributes';
import { installPath } from '../selectors';

import CheckModVersionsButton from './CheckModVersionsButton';
import InstallArchiveButton from './InstallArchiveButton';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as _ from 'lodash';
import * as path from 'path';
import * as React from 'react';
import { ButtonGroup, DropdownButton, Jumbotron, MenuItem } from 'react-bootstrap';
import * as semver from 'semver';

type IModWithState = IMod & IProfileMod;

interface IVersionOptionProps {
  t: I18next.TranslationFunction;
  modId: string;
  altId: string;
  mod: IModWithState;
  onRemove: (modId: string) => void;
}

class VersionOption extends React.PureComponent<IVersionOptionProps, {}> {
  public render(): JSX.Element {
    const { t, modId, altId, mod } = this.props;
    return (
      <div>
        {mod.attributes['version']}
        <IconButton
          id={`btn-remove-${modId}-${altId}`}
          className='btn-embed'
          icon='remove'
          tooltip={t('remove')}
          onClick={this.remove}
        />
      </div>
    );
  }

  private remove = () => {
    this.props.onRemove(this.props.altId);
  }
}

interface IBaseProps {
  objects: ITableAttribute[];
  globalOverlay: JSX.Element;
}

interface IAttributeStateMap {
  [attributeId: string]: IAttributeState;
}

interface IConnectedProps extends IModProps {
  gameMode: string;
  profileId: string;
  language: string;
  installPath: string;
  downloadPath: string;
}

interface IActionProps {
  onSetModAttribute: (gameMode: string, modId: string, attributeId: string, value: any) => void;
  onSetModEnabled: (profileId: string, modId: string, enabled: boolean) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
  onRemoveMod: (gameMode: string, modId: string) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

/**
 * displays the list of mods installed for the current game.
 *
 */
class ModList extends ComponentEx<IProps, {}> {
  private modActions: ITableRowAction[];
  private modEnabledAttribute: ITableAttribute;
  private modNameAttribute: ITableAttribute;
  private modVersionAttribute: ITableAttribute;
  private modVersionDetailAttribute: ITableAttribute;
  private mModsWithState: { [id: string]: IModWithState };
  private mGroupedMods: { [id: string]: IModWithState[] };
  private mPrimaryMods: { [id: string]: IModWithState };
  private staticButtons: IActionDefinition[];

  private modAction: string = '';

  constructor(props: IProps) {
    super(props);

    this.modNameAttribute = {
      id: 'name',
      name: 'Mod Name',
      description: 'Name of the mod',
      icon: 'quote-left',
      calc: (mod) => modName(mod),
      placement: 'both',
      isToggleable: false,
      edit: {
        onChangeValue: (modId: string, value: any) =>
          props.onSetModAttribute(this.props.gameMode, modId, 'customFileName', value),
      },
      isSortable: true,
      filter: new TextFilter(true),
      sortFunc: (lhs: string, rhs: string, locale: string): number => {
        return lhs.localeCompare(rhs, locale, { sensitivity: 'base' });
      },
    };

    this.modEnabledAttribute = {
      id: 'enabled',
      name: 'Status',
      description: 'Is mod enabled in current profile',
      icon: 'check-o',
      calc: (mod: IModWithState) => {
        if (mod.state === 'downloaded') {
          return 'Not Installed';
        }
        return mod.enabled === true ? 'Enabled' : 'Disabled';
      },
      placement: 'table',
      isToggleable: false,
      edit: {
        inline: true,
        choices: () => [
          { key: 'enabled', text: 'Enabled' },
          { key: 'disabled', text: 'Disabled' },
          { key: 'uninstalled', text: 'Not Installed' },
        ],
        onChangeValue: (modId: string, value: any) => {
          const { onRemoveMod, onSetModEnabled, gameMode, profileId } = this.props;

          if (value === undefined) {
            // cycle
            if (this.mModsWithState[modId].state === 'downloaded') {
              // cycle from "not installed" -> "disabled"
              this.context.api.events.emit('start-install-download', modId);
            } else {
              // enabled and disabled toggle to each other so the toggle
              // will never remove the mod
              if (this.mModsWithState[modId].enabled === true) {
                onSetModEnabled(profileId, modId, false);
              } else {
                onSetModEnabled(profileId, modId, true);
              }
              this.context.api.events.emit('mods-enabled', [modId], value);
            }
          } else {
            // direct selection
            if (value === 'uninstalled') {
              // selected "not installed"
              if (this.mModsWithState[modId].state !== 'downloaded') {
                this.context.api.events.emit('remove-mod', gameMode, modId, (err) => {
                  if (err !== null) {
                    return this.context.api.showErrorNotification('Failed to remove mod', err);
                  }
                  this.context.api.events.emit('mods-enabled', [modId], value);
                });
              }
            } else if (this.mModsWithState[modId].state === 'downloaded') {
              // selected "enabled" or "disabled" from "not installed" so first the mod
              // needs to be installed
              this.context.api.events.emit('start-install-download', modId, (err, id) => {
                if (value === 'enabled') {
                  onSetModEnabled(profileId, id, true);
                  this.context.api.events.emit('mods-enabled', [modId], value);
                }
              });
            } else {
              // selected "enabled" or "disabled" from the other one
              onSetModEnabled(profileId, modId, value === 'enabled');
              this.context.api.events.emit('mods-enabled', [modId], value);
            }
          }
        },
      },
      isSortable: false,
    };

    this.modVersionDetailAttribute = {
      id: 'versionDetail',
      name: 'Version',
      description: 'File version (according to the author)',
      icon: 'birthday-cake',
      calc: (mod: IModWithState) => getSafe(mod.attributes, ['version'], ''),
      placement: 'detail',
      isToggleable: false,
      edit: {
        validate: (input: string) => semver.valid(input) ? 'success' : 'warning',
        onChangeValue: (modId: string, value: any) =>
          props.onSetModAttribute(this.props.gameMode, modId, 'version', value),
      },
      isSortable: false,
    };

    this.modVersionAttribute = {
      id: 'version',
      name: 'Version',
      description: 'File version (according to the author)',
      icon: 'birthday-cake',
      calc: this.calcVersion,
      customRenderer: this.renderVersion,
      placement: 'table',
      isToggleable: true,
      edit: {},
      isSortable: false,
    };

    this.modActions = [
      {
        icon: 'check-square-o',
        title: 'Enable selected',
        action: this.enableSelected,
        singleRowAction: false,
      },
      {
        icon: 'square-o',
        title: 'Disable selected',
        action: this.disableSelected,
        singleRowAction: false,
      },
      {
        icon: 'remove',
        title: 'Remove',
        action: this.removeSelected,
      },
    ];

    this.staticButtons = [
      {
        component: InstallArchiveButton,
        props: () => ({}),
      },
      {
        component: CheckModVersionsButton,
        props: () => ({groupedMods: this.mGroupedMods}),
      },
    ];
  }

  public componentWillMount() {
    this.updateModsWithState({ mods: {}, modState: {}, downloads: {} }, this.props);
  }

  public componentWillReceiveProps(newProps: IProps) {
    if ((this.props.mods !== newProps.mods)
      || (this.props.modState !== newProps.modState)
      || (this.props.downloads !== newProps.downloads)) {
      this.updateModsWithState(this.props, newProps);
      this.forceUpdate();
    }
  }

  public render(): JSX.Element {
    const { t, gameMode } = this.props;

    if (gameMode === undefined) {
      // shouldn't happen
      return null;
    }

    if (this.mGroupedMods === undefined) {
      return null;
    }

    return (
      <MainPage>
        <MainPage.Header>
          <IconBar
            group='mod-icons'
            staticElements={this.staticButtons}
            buttonType='icon'
          />
        </MainPage.Header>
        <MainPage.Body>
          <SuperTable
            tableId='mods'

            data={this.mPrimaryMods}
            staticElements={[
              PICTURE,
              this.modEnabledAttribute,
              this.modNameAttribute,
              this.modVersionAttribute,
              this.modVersionDetailAttribute,
              INSTALL_TIME,
            ]}
            actions={this.modActions}
          />
        </MainPage.Body>
        <MainPage.Overlay>
          <IconBar
            group='mod-icons'
            staticElements={this.staticButtons}
            buttonType='both'
            orientation='vertical'
          />
        </MainPage.Overlay>
      </MainPage>
    );
  }

  private calcVersion = (mod: IModWithState): string => {
    const { t } = this.props;
    const version = getSafe(mod.attributes, ['version'], undefined);
    const equalMods = this.mGroupedMods[mod.id];
    if ((equalMods !== undefined) && (equalMods.length > 1)) {
      return version + ' (' + t('{{ count }} more', { count: equalMods.length - 1 }) + ')';
    } else {
      return version;
    }
  }

  private renderVersion = (mod: IModWithState): JSX.Element => {
    const { downloads, downloadPath, mods, t, gameMode } = this.props;
    const equalMods = this.mGroupedMods[mod.id];
    const alternatives = equalMods !== undefined
      ? equalMods.map(iter => iter.id)
      : [mod.id];

    const updateState = modUpdateState(mod, downloadPath, mods);

    const versionDropdown = alternatives.length > 1
      ? (
        <DropdownButton
          className='dropdown-version'
          title={mod.attributes['version'] || ''}
          id={`version-dropdown-${mod.id}`}
          onSelect={this.selectVersion}
        >
          {alternatives.map(altId => this.renderVersionOptions(mod.id, altId))}
        </DropdownButton>
      ) : null;

    return (
      <div className={this.updateClass(updateState)}>
        {alternatives.length === 1 ? mod.attributes['version'] : null}
        <ButtonGroup id={`btngroup-${mod.id}`} className='btngroup-version'>
          {versionDropdown}
          <VersionIconButton
            t={t}
            mod={mod}
            gameMode={gameMode}
            state={updateState}
            downloads={downloads}
            mods={mods}
            downloadPath={downloadPath}
          />
          <VersionChangelogButton
            t={t}
            mod={mod}
          />
        </ButtonGroup>
      </div>
    );
  }

  private updateClass(state: UpdateState) {
    switch (state) {
      case 'bug-update': return 'mod-updating-bug';
      case 'bug-update-site': return 'mod-updating-bug';
      case 'bug-disable': return 'mod-updating-ban';
      case 'update': return 'mod-updating-download';
      case 'update-site': return 'mod-updating-warning';
      default: return 'mod-updating-default';
    }
  }

  private renderVersionOptions(modId: string, altId: string): JSX.Element {
    const { t } = this.props;
    return (
      <MenuItem eventKey={{ modId, altId }} key={altId}>
        <VersionOption
          t={t}
          key={altId}
          modId={modId}
          altId={altId}
          mod={this.mModsWithState[altId]}
          onRemove={this.removeMod}
        />
      </MenuItem>
    );
  }

  private updateModsWithState(oldProps: IModProps, newProps: IModProps) {
    const { gameMode } = this.props;
    let changed = false;
    const newModsWithState = {};

    const installedIds = new Set<string>();

    Object.keys(newProps.mods).forEach(modId => {
      installedIds.add(newProps.mods[modId].archiveId);
      if ((oldProps.mods[modId] !== newProps.mods[modId])
        || (oldProps.modState[modId] !== newProps.modState[modId])) {
        newModsWithState[modId] = Object.assign({}, newProps.mods[modId], newProps.modState[modId]);
        changed = true;
      } else {
        newModsWithState[modId] = this.mModsWithState[modId];
      }
    });

    Object.keys(newProps.downloads).forEach(archiveId => {
      if ((newProps.downloads[archiveId].game === gameMode) && !installedIds.has(archiveId)) {
        if ((oldProps.downloads[archiveId] === newProps.downloads[archiveId])
            && (this.mModsWithState[archiveId] !== undefined)) {
          newModsWithState[archiveId] = this.mModsWithState[archiveId];
          return;
        }
        const filtered = filterModInfo(newProps.downloads[archiveId].modInfo);

        const attributes: any = {
          customFileName: filtered.fileName || newProps.downloads[archiveId].localPath,
        };

        const version = getSafe(filtered, ['version'], undefined);
        if (filtered.version !== undefined) {
          attributes.version = filtered.version;
        }

        newModsWithState[archiveId] = {
            id: archiveId,
            state: 'downloaded',
            archiveId,
            attributes,
        };
        changed = true;
      }
    });

    // if the new mod list is a subset of the old one (including the empty set)
    // the above check wouldn't notice that change
    if (!changed
        && ((this.mModsWithState === undefined)
         || !_.isEqual(Object.keys(newModsWithState), Object.keys(this.mModsWithState)))) {
      changed = true;
    }

    if (changed || (this.mGroupedMods === undefined)) {
      this.updateModGrouping(newModsWithState);
    }
    // assign only after mod grouping is updated so these don't go out of sync
    this.mModsWithState = newModsWithState;
  }

  private updateModGrouping(modsWithState) {
    const modList = Object.keys(modsWithState).map(key => modsWithState[key]);
    const grouped = groupMods(modList, { groupBy: 'file', multipleEnabled: false });

    const groupedMods = grouped.reduce((prev: { [id: string]: IModWithState[] }, value) =>
      setSafe(prev, [value[0].id], value)
      , {});

    this.mPrimaryMods = Object.keys(groupedMods).reduce(
      (prev: { [id: string]: IModWithState }, value) => {
        const prim = groupedMods[value][0];
        return setSafe(prev, [ value ], prim);
      }, {});

    // assign after primary mods are calculated so that in case of an error the two don't become
    // out of sync
    this.mGroupedMods = groupedMods;
  }

  private selectVersion = (evt) => {
    const { profileId, onSetModEnabled } = this.props;
    const { modId, altId } = evt;

    if (modId === altId) {
      return;
    }

    onSetModEnabled(profileId, modId, false);
    onSetModEnabled(profileId, altId, true);

    this.context.api.events.emit('mods-enabled', [modId], false);
    this.context.api.events.emit('mods-enabled', [altId], true);
  }

  private enableSelected = (modIds: string[]) => {
    const { profileId, modState, onSetModEnabled } = this.props;
    this.modAction = 'enabling';

    modIds.forEach((key: string) => {
      if (!getSafe(modState, [key, 'enabled'], false)) {
        onSetModEnabled(profileId, key, true);
      }
    });
    this.context.api.events.emit('mods-enabled', modIds, true);
  }

  private disableSelected = (modIds: string[]) => {
    this.modAction = 'enabling';
    this.disableModsInner(modIds);
    this.context.api.events.emit('mods-enabled', modIds, false);
  }

  private disableModsInner(modIds: string[]) {
    const { profileId, modState, onSetModEnabled } = this.props;
    modIds.forEach((key: string) => {
      if (getSafe(modState, [key, 'enabled'], false)) {
        onSetModEnabled(profileId, key, false);
      }
    });
  }

  private removeMod = (modId: string) => {
    this.removeSelected([modId]);
  }

  private removeSelected = (modIds: string[]) => {
    const { t, gameMode, installPath, onRemoveMod, onShowDialog, mods } = this.props;
    this.modAction = 'removing';

    let removeMods: boolean;
    let removeArchive: boolean;
    let disableDependent: boolean;

    const modNames = modIds.map(modId => {
      let name = modName(this.mModsWithState[modId], {
        version: true,
      });
      if (this.mModsWithState[modId].state === 'downloaded') {
        name += ' ' + t('(Archive only)');
      }
      return name;
    });

    onShowDialog('question', 'Confirm deletion', {
      message: t('Do you really want to delete this mod?',
        { count: modIds.length, replace: { count: modIds.length } })
        + '\n' + modNames.join('\n'),
      checkboxes: [
        { id: 'mod', text: t('Remove Mod'), value: true },
        { id: 'archive', text: t('Remove Archive'), value: false },
        { id: 'dependents', text: t('Disable Dependent'), value: false },
      ],
    }, {
        Cancel: null,
        Remove: null,
      }).then((result: IDialogResult) => {
        removeMods = result.action === 'Remove' && result.input.mod;
        removeArchive = result.action === 'Remove' && result.input.archive;
        disableDependent = result.action === 'Remove' && result.input.dependents;

        if (removeMods) {
          // TODO: this could be more efficient by not doing a clean deployment
          this.disableModsInner(modIds);
          return new Promise<void>((resolve, reject) => {
            this.context.api.events.emit('activate-mods', (err: Error) => {
              if (err === null) {
                resolve();
              } else {
                reject(err);
              }
            });
          })
            .then(() => Promise.map(modIds, (key: string) => {
              if (mods[key] === undefined) {
                return Promise.resolve();
              }
              const fullPath = path.join(installPath, mods[key].installationPath);
              return fs.removeAsync(fullPath);
            }))
            .then(() => undefined);
        } else {
          return Promise.resolve();
        }
      })
      .then(() => {
        modIds.forEach(key => {
          const archiveId = this.mModsWithState[key].archiveId;
          if (removeMods) {
            onRemoveMod(gameMode, key);
          }
          if (removeArchive) {
            this.context.api.events.emit('remove-download', archiveId);
          }
        });
      });
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  const profile = activeProfile(state);
  const gameMode = activeGameId(state);
  const downloadPath = resolvePath('download',
      state.settings.mods.paths, gameMode);

  return {
    mods: state.persistent.mods[gameMode] || {},
    modState: profile !== undefined ? profile.modState : {},
    downloads: state.persistent.downloads.files || {},
    gameMode,
    profileId: profile !== undefined ? profile.id : undefined,
    language: state.settings.interface.language,
    installPath: installPath(state),
    downloadPath,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetModAttribute: (gameMode: string, modId: string, attributeId: string, value: any) => {
      dispatch(setModAttribute(gameMode, modId, attributeId, value));
    },
    onSetModEnabled: (profileId: string, modId: string, enabled: boolean) => {
      dispatch(setModEnabled(profileId, modId, enabled));
    },
    onShowDialog:
    (type, title, content, actions) => dispatch(showDialog(type, title, content, actions)),
    onRemoveMod: (gameMode: string, modId: string) => dispatch(removeMod(gameMode, modId)),
  };
}

function registerModAttribute(instance: ModList, attribute: ITableAttribute) {
  return attribute;
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      extend(registerModAttribute)(
        ModList))) as React.ComponentClass<{}>;
