import { showDialog } from '../../../actions/notifications';
import DropdownButton from '../../../controls/DropdownButton';
import Icon from '../../../controls/Icon';
import IconBar from '../../../controls/IconBar';
import SuperTable, { ITableRowAction } from '../../../controls/Table';
import TextFilter from '../../../controls/table/TextFilter';
import { IconButton } from '../../../controls/TooltipControls';
import { IActionDefinition } from '../../../types/IActionDefinition';
import { IAttributeState } from '../../../types/IAttributeState';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../../types/IDialog';
import { IState } from '../../../types/IState';
import { ITableAttribute } from '../../../types/ITableAttribute';
import { ComponentEx, connect, extend, translate } from '../../../util/ComponentEx';
import Debouncer from '../../../util/Debouncer';
import { activeGameId, activeProfile } from '../../../util/selectors';
import { getSafe, setSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';
import MainPage from '../../../views/MainPage';

import { IDownload } from '../../download_management/types/IDownload';
import { setModEnabled } from '../../profile_management/actions/profiles';
import { IProfileMod } from '../../profile_management/types/IProfile';

import { removeMod, setModAttribute } from '../actions/mods';
import { IMod } from '../types/IMod';
import { IModProps } from '../types/IModProps';
import { IModSource } from '../types/IModSource';
import filterModInfo from '../util/filterModInfo';
import groupMods from '../util/modGrouping';
import modName from '../util/modName';
import modUpdateState, { UpdateState } from '../util/modUpdateState';
import resolvePath from '../util/resolvePath';
import VersionChangelogButton from '../views/VersionChangelogButton';
import VersionIconButton from '../views/VersionIconButton';

import { INSTALL_TIME, PICTURE } from '../modAttributes';
import { installPath as installPathSelector } from '../selectors';
import getText from '../texts';

import CheckModVersionsButton from './CheckModVersionsButton';
import InstallArchiveButton from './InstallArchiveButton';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as I18next from 'i18next';
import * as _ from 'lodash';
import * as path from 'path';
import * as React from 'react';
import { Button, ButtonGroup, Jumbotron, MenuItem } from 'react-bootstrap';
import * as ReactDOM from 'react-dom';
import * as Redux from 'redux';
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
  globalOverlay: JSX.Element;
  modSources: IModSource[];
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

interface IComponentState {
  bounds: ClientRect;
}

/**
 * displays the list of mods installed for the current game.
 *
 */
class ModList extends ComponentEx<IProps, IComponentState> {
  private modActions: ITableRowAction[];
  private modEnabledAttribute: ITableAttribute;
  private modNameAttribute: ITableAttribute;
  private modVersionAttribute: ITableAttribute;
  private modVersionDetailAttribute: ITableAttribute;
  private mModsWithState: { [id: string]: IModWithState };
  private mGroupedMods: { [id: string]: IModWithState[] };
  private mPrimaryMods: { [id: string]: IModWithState };
  private mUpdateDebouncer: Debouncer;
  private mLastUpdateProps: IModProps = { mods: {}, modState: {}, downloads: {} };
  private mIsMounted: boolean = false;
  private staticButtons: IActionDefinition[];
  private mRef: Element;

  constructor(props: IProps) {
    super(props);

    this.initAttributes();

    this.modActions = [
      {
        icon: 'square-check',
        title: 'Enable',
        action: this.enableSelected,
        singleRowAction: false,
      },
      {
        icon: 'square-empty',
        title: 'Disable',
        action: this.disableSelected,
        singleRowAction: false,
      },
      {
        icon: 'remove',
        title: 'Remove',
        action: this.removeSelected,
        hotKey: { code: 46 },
      },
      {
        icon: 'cloud-refresh',
        title: 'Check for update',
        action: this.checkForUpdate,
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

    this.mUpdateDebouncer = new Debouncer(
      (newProps) => this.updateModsWithState(newProps), 100);

    this.state = {
      bounds: { top: 0, bottom: 0, height: 0, width: 0, left: 0, right: 0 },
    };
  }

  public componentWillMount() {
    this.mIsMounted = true;
    this.updateModsWithState(this.props)
    .then(() => this.forceUpdate());
  }

  public setBoundsRef = ref => {
    this.mRef = ReactDOM.findDOMNode(ref);
    this.forceUpdate();
  }

  public componentWillUnmount() {
    this.mIsMounted = false;
  }

  public componentWillReceiveProps(newProps: IProps) {
    if ((this.props.gameMode !== newProps.gameMode)
        || (this.props.mods !== newProps.mods)
        || (this.props.modState !== newProps.modState)
        || (this.props.downloads !== newProps.downloads)) {
      this.mUpdateDebouncer.schedule(() => {
        if (this.mIsMounted) {
          this.forceUpdate();
        }
      }, newProps);
    }
  }

  public render(): JSX.Element {
    const { t, gameMode, modSources } = this.props;

    if (gameMode === undefined) {
      // shouldn't happen
      return null;
    }

    if (this.mGroupedMods === undefined) {
      return null;
    }

    return (
      <MainPage ref={this.setBoundsRef}>
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
            detailsTitle={t('Mod Attributes')}

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
          >
          {this.renderMoreMods(modSources)}
          </SuperTable>
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

  private renderMoreMods(sources: IModSource[]): JSX.Element {
    const { t } = this.props;
    if (sources.length === 1) {
      return (
        <IconButton
          id='btn-more-mods'
          tooltip={t('Browse for more mods')}
          onClick={sources[0].onBrowse}
          icon='plus'
        >
          {t('Get more mods')}
        </IconButton>
      );
    }

    const title = (
      <div style={{ display: 'inline' }}>
        <Icon name='plus' />
        {t('Get more mods')}
      </div>
    );

    return (
      <DropdownButton
        id='btn-more-mods'
        title={title as any}
        container={this.mRef}
      >
        {sources.map(this.renderModSource)}
      </DropdownButton>
    );
  }

  private renderModSource = (source: IModSource) => {
    return <MenuItem key={source.id} onSelect={source.onBrowse}>{source.name}</MenuItem>;
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
          container={this.mRef}
        >
          {alternatives.map(altId => this.renderVersionOptions(mod.id, altId))}
        </DropdownButton>
      ) : null;

    return (
      <div className={'mod-update ' + this.updateClass(updateState)}>
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
      case 'bug-update': return 'bug';
      case 'bug-update-site': return 'bug';
      case 'bug-disable': return 'ban';
      case 'update': return 'download';
      case 'update-site': return 'warning';
      default: return 'default';
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

  private initAttributes() {
    let lang: string;
    let collator: Intl.Collator;

    this.modNameAttribute = {
      id: 'name',
      name: 'Mod Name',
      description: 'Name of the mod',
      icon: 'quote-left',
      calc: (mod) => modName(mod),
      placement: 'both',
      isToggleable: false,
      edit: {
        readOnly: (mod: IModWithState) => mod.state === 'downloaded',
        onChangeValue: (modId: string, value: any) =>
          this.props.onSetModAttribute(this.props.gameMode, modId, 'customFileName', value),
      },
      isSortable: true,
      isDefaultSort: true,
      filter: new TextFilter(true),
      sortFunc: (lhs: string, rhs: string, locale: string): number => {
        if ((collator === undefined) || (locale !== lang)) {
          lang = locale;
          collator = new Intl.Collator(locale, { sensitivity: 'base' });
        }
        return collator.compare(lhs, rhs);
      },
    };

    this.modEnabledAttribute = {
      id: 'enabled',
      name: 'Status',
      description: 'Is mod enabled in current profile',
      icon: 'check-o',
      calc: (mod: IModWithState) => {
        if (mod.state === 'downloaded') {
          return 'Uninstalled';
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
          { key: 'uninstalled', text: 'Uninstalled' },
        ],
        onChangeValue: this.changeModEnabled,
      },
      isSortable: false,
    };

    this.modVersionDetailAttribute = {
      id: 'versionDetail',
      name: 'Version',
      description: 'File version (according to the author)',
      help: getText('version', this.props.t),
      icon: 'cake',
      calc: (mod: IModWithState) => getSafe(mod.attributes, ['version'], ''),
      placement: 'detail',
      isToggleable: false,
      edit: {
        readOnly: (mod: IModWithState) => mod.state === 'downloaded',
        validate: (input: string) => semver.valid(input) ? 'success' : 'warning',
        onChangeValue: (modId: string, value: any) =>
          this.props.onSetModAttribute(this.props.gameMode, modId, 'version', value),
      },
      isSortable: false,
    };

    this.modVersionAttribute = {
      id: 'version',
      name: 'Version',
      description: 'File version (according to the author)',
      icon: 'cake',
      calc: this.calcVersion,
      customRenderer: this.renderVersion,
      placement: 'table',
      isToggleable: true,
      edit: {},
      isSortable: false,
    };

  }

  private updateModsWithState(newProps: IProps): Promise<void> {
    const { gameMode } = newProps;
    let changed = false;
    const newModsWithState = {};

    const installedIds = new Set<string>();
    const oldProps = this.mLastUpdateProps;

    // update mods as necessary
    Object.keys(newProps.mods).forEach(modId => {
      installedIds.add(newProps.mods[modId].archiveId);
      if ((oldProps.mods[modId] !== newProps.mods[modId])
          || (oldProps.modState[modId] !== newProps.modState[modId])) {
        newModsWithState[modId] = {
          ...newProps.mods[modId],
          ...newProps.modState[modId],
        };
        changed = true;
      } else {
        newModsWithState[modId] = this.mModsWithState[modId];
      }
    });

    // insert downloads. Since this requires deriving mod attributes from
    // the source-specific data we need to do this asynchronously although
    // we expect all attributes to be available instantaneous.
    return Promise.map(Object.keys(newProps.downloads), archiveId => {
      if ((newProps.downloads[archiveId].game === gameMode)
        && (newProps.downloads[archiveId].state === 'finished')
        && !installedIds.has(archiveId)) {
        if ((oldProps.downloads[archiveId] === newProps.downloads[archiveId])
          && (this.mModsWithState[archiveId] !== undefined)) {
          newModsWithState[archiveId] = this.mModsWithState[archiveId];
          return;
        }
        return filterModInfo(newProps.downloads[archiveId].modInfo, undefined)
        .then(info => ({ archiveId, info }));
      } else {
        return Promise.resolve(undefined);
      }
    })
      .then((modAttributes: Array<{ archiveId: string, info: any }>) => {
        modAttributes.filter(attribute => attribute !== undefined).forEach(mod => {
          // complete attributes that we don't otherwise find for downloads
          newModsWithState[mod.archiveId] = {
            ...mod.info,
            id: mod.archiveId,
            state: 'downloaded',
            archiveId: mod.archiveId,
            attributes: {
              ...mod.info,
              customFileName: mod.info.fileName || newProps.downloads[mod.archiveId].localPath,
              installTime: newProps.downloads[mod.archiveId].fileTime,
            },
          };
          changed = true;
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
        this.mLastUpdateProps = newProps;
        return null;
      });
  }

  private cycleModState(profileId: string, modId: string, newValue: string) {
    const { onSetModEnabled } = this.props;

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
      this.context.api.events.emit('mods-enabled', [modId], newValue);
    }
  }

  private setModState(profileId: string, modId: string, value: string) {
    const { gameMode, onSetModEnabled } = this.props;
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

  private changeModEnabled = (modId: string, value: any) => {
    const { profileId } = this.props;

    if (value === undefined) {
      this.cycleModState(profileId, modId, value);
    } else {
      this.setModState(profileId, modId, value);
    }
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

    modIds.forEach((key: string) => {
      if (!getSafe(modState, [key, 'enabled'], false)) {
        this.setModState(profileId, key, 'enabled');
      }
    });
    this.context.api.events.emit('mods-enabled', modIds, true);
  }

  private disableSelected = (modIds: string[]) => {
    this.disableModsInner(modIds);
    this.context.api.events.emit('mods-enabled', modIds, false);
  }

  private disableModsInner(modIds: string[]) {
    const { profileId, modState, onSetModEnabled } = this.props;
    modIds.forEach(key => {
      if (getSafe(modState, [key, 'enabled'], false)) {
        onSetModEnabled(profileId, key, false);
      }
    });
  }

  private removeMod = (modId: string) => {
    this.removeSelected([modId]);
  }

  private removeMods(modIds: string[]): Promise<void> {
    const { installPath, mods } = this.props;

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
      .then(() => Promise.map(modIds, key =>
        ((mods[key] !== undefined) && truthy(mods[key].installationPath))
          ? fs.removeAsync(path.join(installPath, mods[key].installationPath))
          : Promise.resolve())
        .then(() => undefined));
  }

  private removeSelected = (modIds: string[]) => {
    const { t, gameMode, installPath, onRemoveMod, onShowDialog, mods } = this.props;

    let removeMods: boolean;
    let removeArchive: boolean;

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
      ],
    }, [ { label: 'Cancel' }, { label: 'Remove' } ])
    .then((result: IDialogResult) => {
        removeMods = result.action === 'Remove' && result.input.mod;
        removeArchive = result.action === 'Remove' && result.input.archive;

        return (removeMods ? this.removeMods(modIds) : Promise.resolve())
          .then(() => modIds.forEach(key => {
            const archiveId = this.mModsWithState[key].archiveId;
            if (removeMods) {
              onRemoveMod(gameMode, key);
            }
            if (removeArchive) {
              this.context.api.events.emit('remove-download', archiveId);
            }
          }));
      });
  }

  private checkForUpdate = (modIds: string[]) => {
    const { gameMode, mods } = this.props;

    this.context.api.events.emit('check-mods-version', gameMode, _.pick(mods, modIds));
  }
}

const empty = {};

function mapStateToProps(state: IState): IConnectedProps {
  const profile = activeProfile(state);
  const gameMode = activeGameId(state);
  const downloadPath = resolvePath('download',
      state.settings.mods.paths, gameMode);

  return {
    mods: state.persistent.mods[gameMode] || empty,
    modState: profile !== undefined ? profile.modState : empty,
    downloads: state.persistent.downloads.files || empty,
    gameMode,
    profileId: profile !== undefined ? profile.id : undefined,
    language: state.settings.interface.language,
    installPath: installPathSelector(state),
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

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      ModList)) as React.ComponentClass<{}>;
