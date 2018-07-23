import { showDialog } from '../../../actions/notifications';
import CollapseIcon from '../../../controls/CollapseIcon';
import DropdownButton from '../../../controls/DropdownButton';
import Dropzone, { DropType } from '../../../controls/Dropzone';
import EmptyPlaceholder from '../../../controls/EmptyPlaceholder';
import FlexLayout from '../../../controls/FlexLayout';
import Icon from '../../../controls/Icon';
import IconBar from '../../../controls/IconBar';
import SuperTable, { ITableRowAction } from '../../../controls/Table';
import OptionsFilter from '../../../controls/table/OptionsFilter';
import TextFilter from '../../../controls/table/TextFilter';
import { IconButton } from '../../../controls/TooltipControls';
import { IActionDefinition } from '../../../types/IActionDefinition';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../../types/IDialog';
import { IState } from '../../../types/IState';
import { ITableAttribute } from '../../../types/ITableAttribute';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { ProcessCanceled, TemporaryError, UserCanceled } from '../../../util/CustomErrors';
import Debouncer from '../../../util/Debouncer';
import * as fs from '../../../util/fs';
import { activeGameId, activeProfile } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';
import MainPage from '../../../views/MainPage';

import { setModEnabled } from '../../profile_management/actions/profiles';
import { IProfileMod } from '../../profile_management/types/IProfile';

import { removeMod, setModAttribute } from '../actions/mods';
import { setShowModDropzone } from '../actions/settings';
import { IMod } from '../types/IMod';
import { IModProps } from '../types/IModProps';
import { IModSource } from '../types/IModSource';
import filterModInfo from '../util/filterModInfo';
import groupMods from '../util/modGrouping';
import modName from '../util/modName';
import modUpdateState, { UpdateState } from '../util/modUpdateState';
import resolvePath from '../util/resolvePath';
import VersionFilter from '../util/VersionFilter';
import VersionChangelogButton from '../views/VersionChangelogButton';
import VersionIconButton from '../views/VersionIconButton';

import { INSTALL_TIME, PICTURE } from '../modAttributes';
import { installPath as installPathSelector } from '../selectors';
import getText from '../texts';

import CheckModVersionsButton from './CheckModVersionsButton';
import InstallArchiveButton from './InstallArchiveButton';

import * as Promise from 'bluebird';
import * as I18next from 'i18next';
import * as _ from 'lodash';
import * as path from 'path';
import * as React from 'react';
import { Button, ButtonGroup, Jumbotron, MenuItem, Panel } from 'react-bootstrap';
import * as ReactDOM from 'react-dom';
import * as Redux from 'redux';
import * as semver from 'semver';

const PanelX: any = Panel;

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
    if (mod === undefined) {
      return null;
    }

    const variant = getSafe(mod.attributes, ['variant'], undefined);

    return (
      <a className='version-option'>
        <div>
          {getSafe(mod.attributes, ['version'], '')}
          {variant !== undefined ? ` (${variant})` : ''}
        </div>
        <IconButton
          id={`btn-remove-${modId}-${altId}`}
          className='btn-embed'
          icon='remove'
          tooltip={t('remove')}
          onClick={this.remove}
        />
      </a>
    );
  }

  private remove = (evt) => {
    evt.preventDefault();
    this.props.onRemove(this.props.altId);
  }
}

interface IBaseProps {
  globalOverlay: JSX.Element;
  modSources: IModSource[];
}

interface IConnectedProps extends IModProps {
  gameMode: string;
  profileId: string;
  language: string;
  installPath: string;
  downloadPath: string;
  showDropzone: boolean;
}

interface IActionProps {
  onSetModAttribute: (gameMode: string, modId: string, attributeId: string, value: any) => void;
  onSetModEnabled: (profileId: string, modId: string, enabled: boolean) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
  onRemoveMod: (gameMode: string, modId: string) => void;
  onShowDropzone: (show: boolean) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

interface IComponentState {
  bounds: ClientRect;
}

const nop = () => null;

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
  private modVariantDetailAttribute: ITableAttribute;
  private modAuthorAttribute: ITableAttribute<IModWithState>;
  private mModsWithState: { [id: string]: IModWithState };
  private mGroupedMods: { [id: string]: IModWithState[] } = {};
  private mPrimaryMods: { [id: string]: IModWithState } = {};
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
        icon: 'checkbox-checked',
        title: 'Enable',
        action: this.enableSelected,
        singleRowAction: false,
      },
      {
        icon: 'checkbox-unchecked',
        title: 'Disable',
        action: this.disableSelected,
        singleRowAction: false,
      },
      {
        icon: 'delete',
        title: 'Remove',
        action: this.removeSelected,
        condition: instanceId => (typeof(instanceId) === 'string')
            ? (['downloaded', 'installed'].indexOf(this.mModsWithState[instanceId].state) !== -1)
            : true,
        hotKey: { code: 46 },
      },
      {
        icon: 'refresh',
        title: 'Check for update',
        action: this.checkForUpdate,
        condition: instanceId => {
          const { mods } = this.props;
          if (typeof(instanceId) === 'string') {
            return mods[instanceId] !== undefined;
          } else {
            return instanceId.find(id => mods[id] !== undefined) !== undefined;
          }
        },
      },
      {
        icon: 'start-install',
        title: 'Install',
        action: this.install,
        condition: (instanceId: string) => this.props.mods[instanceId] === undefined,
        position: 50,
      },
      {
        icon: 'start-install',
        title: 'Reinstall',
        action: this.reinstall,
        condition: (instanceId: string) => {
          if (this.props.mods[instanceId] === undefined) {
            return false;
          }
          return truthy(this.props.mods[instanceId].archiveId)
               || this.props.t('No associated archive.');
        },
        singleRowAction: true,
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

    this.mUpdateDebouncer = new Debouncer((newProps) => {
        this.updateModsWithState(newProps)
          .then(() => {
            if (this.mIsMounted) {
              this.forceUpdate();
            }
          });
        return null;
      }, 500);

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
    if (ref !== null) {
      this.mRef = ReactDOM.findDOMNode(ref);
      this.forceUpdate();
    }
  }

  public componentWillUnmount() {
    this.mIsMounted = false;
  }

  public shouldComponentUpdate() {
    return false;
  }

  public componentWillReceiveProps(newProps: IProps) {
    if ((this.props.gameMode !== newProps.gameMode)
        || (this.props.mods !== newProps.mods)
        || (this.props.modState !== newProps.modState)
        || (this.props.downloads !== newProps.downloads)
        || (this.props.showDropzone !== newProps.showDropzone)) {
      this.mUpdateDebouncer.schedule(undefined, newProps);
    }
  }

  public render(): JSX.Element {
    const { t, gameMode, modSources, showDropzone } = this.props;

    if (gameMode === undefined) {
      // shouldn't happen
      return null;
    }

    if (this.mGroupedMods === undefined) {
      return null;
    }

    let content: JSX.Element;

    if (Object.keys(this.mPrimaryMods).length === 0) {
      // for some reason I can't use the <Panel> control, it ends up
      // having no body
      content = (
        <div className='panel'>
          <div className='panel-body'>
            <EmptyPlaceholder
              icon='folder-download'
              fill={true}
              text={t('You don\'t have any installed mods')}
              subtext={<a onClick={this.getMoreMods}>{t('But don\'t worry, I know a place...')}</a>}
            />
          </div>
        </div>
      );
    } else {
      content = (
        <Panel>
          <PanelX.Body>
            <SuperTable
              tableId='mods'
              detailsTitle={t('Mod Attributes')}

              data={this.mPrimaryMods}
              staticElements={[
                PICTURE,
                this.modEnabledAttribute,
                this.modNameAttribute,
                this.modVersionAttribute,
                this.modAuthorAttribute,
                this.modVersionDetailAttribute,
                this.modVariantDetailAttribute,
                INSTALL_TIME,
              ]}
              actions={this.modActions}
            >
              {this.renderMoreMods(modSources)}
            </SuperTable>
          </PanelX.Body>
        </Panel>
      );
    }

    return (
      <MainPage ref={this.setBoundsRef}>
        <MainPage.Header>
          <IconBar
            group='mod-icons'
            staticElements={this.staticButtons}
            className='menubar'
            t={t}
          />
        </MainPage.Header>
        <MainPage.Body>
          <FlexLayout type='column'>
            <FlexLayout.Flex>
              {content}
            </FlexLayout.Flex>
            <FlexLayout.Fixed>
              <PanelX
                className='mod-drop-panel'
                expanded={showDropzone}
                onToggle={nop}
              >
                <PanelX.Collapse>
                  <PanelX.Body>
                    <Dropzone
                      accept={['files']}
                      drop={this.dropMod}
                      icon='folder-download'
                      clickable={false}
                    />
                  </PanelX.Body>
                </PanelX.Collapse>
                <CollapseIcon
                  position='topright'
                  onClick={this.toggleDropzone}
                  visible={showDropzone}
                />
              </PanelX>
            </FlexLayout.Fixed>
          </FlexLayout>
        </MainPage.Body>
      </MainPage>
    );
  }

  private renderMoreMods(sources: IModSource[]): JSX.Element {
    const { t } = this.props;
    if (sources.length === 1) {
      return (
        <Button
          id='btn-more-mods'
          onClick={sources[0].onBrowse}
          bsStyle='ghost'
        >
          {t('Get more mods')}
        </Button>
      );
    }

    const title = (
      <div style={{ display: 'inline' }}>
        <Icon name='add' />
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

  private getMoreMods = () => {
    if (this.props.modSources.length > 0) {
      this.props.modSources[0].onBrowse();
    }
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

    const updateState = modUpdateState(mod.attributes);

    const variant = getSafe(mod.attributes, ['variant'], undefined);

    const versionDropdown = alternatives.length > 1
      ? (
        <DropdownButton
          className='dropdown-version'
          title={
            (getSafe(mod.attributes, ['version'], undefined) || '')
            + (variant !== undefined ? ` (${variant})` : '')
          }
          id={`version-dropdown-${mod.id}`}
          container={this.mRef}
        >
          {alternatives.map(altId => this.renderVersionOptions(mod.id, altId))}
        </DropdownButton>
      ) : null;

    return (
      <div className={'mod-update ' + this.updateClass(updateState)}>
        {alternatives.length === 1 ? getSafe(mod.attributes, ['version'], null) : null}
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
      <li
        role='presentation'
        key={altId}
        data-modid={modId}
        data-altid={altId}
        onClick={this.selectVersionClick}
      >
        <VersionOption
          t={t}
          key={altId}
          modId={modId}
          altId={altId}
          mod={this.mModsWithState[altId]}
          onRemove={this.removeMod}
        />
      </li>
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
        onChangeValue: (mod: IModWithState, value: any) =>
          this.props.onSetModAttribute(this.props.gameMode, mod.id, 'customFileName', value),
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
          return (getSafe(mod.attributes, ['wasInstalled'], false))
            ? 'Uninstalled'
            : 'Never Installed';
        } else if (mod.state === 'installing') {
          return 'Installing';
        }
        return mod.enabled === true ? 'Enabled' : 'Disabled';
      },
      placement: 'table',
      isToggleable: false,
      edit: {
        inline: true,
        choices: () => [
          { key: 'enabled', text: 'Enabled', icon: 'toggle-enabled' },
          { key: 'disabled', text: 'Disabled', icon: 'toggle-disabled' },
          { key: 'uninstalled', text: 'Uninstalled', icon: 'toggle-uninstalled' },
          { key: 'neverinstalled', text: 'Never Installed',
            icon: 'toggle-uninstalled', visible: false },
          { key: 'installing', text: 'Installing', icon: 'spinner', visible: false },
        ],
        onChangeValue: this.changeModEnabled,
      },
      isSortable: false,
      filter: new OptionsFilter([
        { value: true, label: 'Enabled' },
        { value: false, label: 'Disabled' },
        { value: undefined, label: 'Uninstalled' },
      ], true),
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
        onChangeValue: (mod: IModWithState, value: any) =>
          this.props.onSetModAttribute(this.props.gameMode, mod.id, 'version', value),
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
      isVolatile: true,
      edit: {},
      isSortable: false,
      filter: new VersionFilter(),
    };

    this.modVariantDetailAttribute = {
      id: 'variantDetail',
      name: 'Variant',
      description: 'File variant',
      help: getText('variant', this.props.t),
      calc: (mod: IModWithState) => getSafe(mod.attributes, ['variant'], ''),
      placement: 'detail',
      isToggleable: false,
      edit: {
        readOnly: (mod: IModWithState) => mod.state === 'downloaded',
        onChangeValue: (mod: IModWithState, value: any) =>
          this.props.onSetModAttribute(this.props.gameMode, mod.id, 'variant', value),
      },
      isSortable: false,
    };

    this.modAuthorAttribute = {
      id: 'author',
      name: 'Author',
      description: 'Author of the mod',
      icon: 'author',
      calc: mod => getSafe(mod.attributes, ['author'], ''),
      placement: 'both',
      isToggleable: true,
      isDefaultVisible: false,
      isSortable: true,
      sortFunc: (lhs: string, rhs: string) =>
        lhs.localeCompare(rhs, this.props.language, { caseFirst: 'false' }),
      edit: {},
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
          enabled: false, // ensure we have an enabled-state even when no state is stored
                          // for the mod
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
        return filterModInfo({ download: newProps.downloads[archiveId] }, undefined)
        .then(info => ({ archiveId, info }));
      } else {
        return Promise.resolve(undefined);
      }
    })
      .then((modAttributes: Array<{ archiveId: string, info: any }>) => {
        modAttributes.filter(attribute => attribute !== undefined).forEach(mod => {
          const download = newProps.downloads[mod.archiveId];
          // complete attributes that we don't otherwise find for downloads
          newModsWithState[mod.archiveId] = {
            id: mod.archiveId,
            state: 'downloaded',
            archiveId: mod.archiveId,
            attributes: {
              ...mod.info,
              installTime: download.fileTime,
              wasInstalled: download.installed !== undefined,
            },
          };
          changed = true;
        });

        // if the new mod list is a subset of the old one (including the empty set)
        // the above check wouldn't notice that change
        if (!changed && ((this.mModsWithState === undefined)
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
    if (this.mModsWithState[modId] === undefined) {
      return;
    }
    // direct selection
    if (value === 'uninstalled') {
      // selected "not installed"
      if (this.mModsWithState[modId].state !== 'downloaded') {
        this.context.api.events.emit('remove-mod', gameMode, modId, (err) => {
          if (err !== null) {
            if (err instanceof UserCanceled) {
              // the user knows that he cancelled, no need to notify
              return;
            } else if (err instanceof TemporaryError) {
              return this.context.api.showErrorNotification(
                'Failed to remove mod, please try again',
                err.message, { allowReport: false });
            } else if (err instanceof ProcessCanceled) {
              return this.context.api.showErrorNotification('Failed to remove mod', err.message,
                { allowReport: false });
            } else {
              return this.context.api.showErrorNotification('Failed to remove mod', err);
            }
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

  private changeModEnabled = (mod: IModWithState, value: any) => {
    const { profileId } = this.props;

    if ((this.mModsWithState[mod.id] === undefined)
        || (this.mModsWithState[mod.id].state === 'installing')) {
      // can't change state while installing
      return;
    }

    if (value === undefined) {
      this.cycleModState(profileId, mod.id, value);
    } else {
      this.setModState(profileId, mod.id, value);
    }
  }

  private updateModGrouping(modsWithState) {
    const modList = Object.keys(modsWithState).map(key => modsWithState[key]);
    const grouped = groupMods(modList, { groupBy: 'file', multipleEnabled: false });

    const groupedMods = grouped.reduce((prev: { [id: string]: IModWithState[] }, value) => {
      prev[value[0].id] = value;
      return prev;
    }, {});

    this.mPrimaryMods = Object.keys(groupedMods).reduce(
      (prev: { [id: string]: IModWithState }, value) => {
        const prim = groupedMods[value][0];
        prev[value] = prim;
        return prev;
      }, {});

    // assign after primary mods are calculated so that in case of an error the two don't become
    // out of sync
    this.mGroupedMods = groupedMods;
  }

  private selectVersionClick = (event) => {
    if (event.isDefaultPrevented()) {
      return;
    }
    this.selectVersion({
      modId: event.currentTarget.getAttribute('data-modid'),
      altId: event.currentTarget.getAttribute('data-altid'),
    });
  }

  private selectVersion = (evtKey) => {
    const { profileId, onSetModEnabled } = this.props;
    const { modId, altId } = evtKey;

    if (modId === altId) {
      return;
    }

    onSetModEnabled(profileId, modId, false);
    if ((this.mModsWithState[altId] !== undefined)
        && (this.mModsWithState[altId].state === 'downloaded')) {
      this.context.api.events.emit('start-install-download', altId, (err, id) => {
        if (err === null) {
          onSetModEnabled(profileId, id, true);
        }
      });
    } else {
      onSetModEnabled(profileId, altId, true);
    }

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
      this.context.api.events.emit('deploy-mods', (err: Error) => {
        if (err === null) {
          resolve();
        } else {
          reject(err);
        }
      });
    })
      .then(() => Promise.map(modIds, key =>
        ((mods[key] !== undefined)
         && truthy(mods[key].installationPath)
         && (['downloaded', 'installed'].indexOf(mods[key].state) !== -1))
          ? fs.removeAsync(path.join(installPath, mods[key].installationPath))
              .catch(err => {
                this.context.api.showErrorNotification('Failed to remove mod', err);
              })
            : Promise.resolve())
        .then(() => undefined));
  }

  private removeSelected = (modIds: string[]) => {
    const { t, gameMode, onRemoveMod, onShowDialog } = this.props;

    let removeMods: boolean;
    let removeArchive: boolean;

    const filteredIds = modIds
      .filter(modId => this.mModsWithState[modId] !== undefined)
      .filter(modId =>
        ['downloaded', 'installed'].indexOf(this.mModsWithState[modId].state) !== -1);

    if (filteredIds.length === 0) {
      return;
    }

    let allArchives = true;
    const modNames = filteredIds
      .map(modId => {
        let name = modName(this.mModsWithState[modId], {
          version: true,
        });
        if (this.mModsWithState[modId].state === 'downloaded') {
          name += ' ' + t('(Archive only)');
        } else {
          allArchives = false;
        }
        return name;
    });

    const checkboxes = allArchives
      ? [ { id: 'archive', text: t('Remove Archive'), value: true } ]
      : [
        { id: 'mod', text: t('Remove Mod'), value: true },
        { id: 'archive', text: t('Remove Archive'), value: false },
      ];

    onShowDialog('question', 'Confirm deletion', {
      message: t('Do you really want to delete this mod?',
        { count: filteredIds.length, replace: { count: filteredIds.length } })
        + '\n' + modNames.join('\n'),
      checkboxes,
    }, [ { label: 'Cancel' }, { label: 'Remove' } ])
    .then((result: IDialogResult) => {
        removeMods = result.action === 'Remove' && result.input.mod;
        removeArchive = result.action === 'Remove' && result.input.archive;

        return (removeMods ? this.removeMods(filteredIds) : Promise.resolve())
          .then(() => filteredIds.forEach(key => {
            if (removeMods) {
              onRemoveMod(gameMode, key);
            }

            if (removeArchive && (this.mModsWithState[key] !== undefined)) {
              const archiveId = this.mModsWithState[key].archiveId;
              if (removeArchive) {
                this.context.api.events.emit('remove-download', archiveId);
              }
            }
          }));
      });
  }

  private install = (archiveIds: string[]) => {
    if (Array.isArray(archiveIds)) {
      archiveIds.forEach(archiveId =>
        this.context.api.events.emit('start-install-download', archiveId));
    } else {
      this.context.api.events.emit('start-install-download', archiveIds);
    }
  }

  private reinstall = (modIds: string | string[]) => {
    const { mods, modState } = this.props;
    if (Array.isArray(modIds)) {
      modIds.filter(modId => mods[modId] !== undefined).forEach(modId =>
        this.context.api.events.emit('start-install-download', mods[modId].archiveId, (err) => {
          if (err === null) {
            const enabled = modIds.filter(id => getSafe(modState, [id, 'enabled'], false));
            if (enabled.length > 0) {
              this.context.api.events.emit('mods-enabled', enabled, true);
            }
          }
        }));
    } else if (mods[modIds] !== undefined) {
      this.context.api.events.emit('start-install-download', mods[modIds].archiveId, (err) => {
        if (err === null) {
          if (modState[modIds].enabled) {
            // reinstalling an enabled mod automatically enables the new one so we also need
            // to trigger this event
            this.context.api.events.emit('mods-enabled', [modIds], true);
          }
        }
      });
    }
  }

  private toggleDropzone = () => {
    const { showDropzone, onShowDropzone } = this.props;
    onShowDropzone(!showDropzone);
  }

  private checkForUpdate = (modIds: string[]) => {
    const { gameMode, mods } = this.props;

    this.context.api.events.emit('check-mods-version', gameMode, _.pick(mods, modIds));
  }

  private dropMod = (type: DropType, values: string[]) => {
    this.context.api.events.emit('import-downloads', values);
  }
}

const empty = {};

function mapStateToProps(state: IState): IConnectedProps {
  const profile = activeProfile(state);
  const gameMode = activeGameId(state);
  const downloadPath = resolvePath('download',
      state.settings.mods.paths, gameMode);

  return {
    mods: getSafe(state, ['persistent', 'mods', gameMode], empty),
    modState: getSafe(profile, ['modState'], empty),
    downloads: getSafe(state, ['persistent', 'downloads', 'files'], empty),
    gameMode,
    profileId: getSafe(profile, ['id'], undefined),
    language: state.settings.interface.language,
    installPath: installPathSelector(state),
    downloadPath,
    showDropzone: state.settings.mods.showDropzone,
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
    onShowDropzone: (show: boolean) => dispatch(setShowModDropzone(show)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      ModList)) as React.ComponentClass<{}>;
