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
import { INotification } from '../../../types/INotification';
import { IState } from '../../../types/IState';
import { ITableAttribute } from '../../../types/ITableAttribute';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { ProcessCanceled, UserCanceled } from '../../../util/CustomErrors';
import Debouncer from '../../../util/Debouncer';
import * as selectors from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';
import MainPage from '../../../views/MainPage';

import getDownloadGames from '../../download_management/util/getDownloadGames';
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
import VersionFilter from '../util/VersionFilter';
import VersionChangelogButton from '../views/VersionChangelogButton';
import VersionIconButton from '../views/VersionIconButton';

import { ENABLED_TIME, INSTALL_TIME, PICTURE } from '../modAttributes';
import getText from '../texts';

import Author from './Author';
import CheckModVersionsButton from './CheckModVersionsButton';
import InstallArchiveButton from './InstallArchiveButton';

import Promise from 'bluebird';
import { TFunction } from 'i18next';
import * as _ from 'lodash';
import * as React from 'react';
import { Button, ButtonGroup, MenuItem, Panel } from 'react-bootstrap';
import * as ReactDOM from 'react-dom';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import * as semver from 'semver';

type IModWithState = IMod & IProfileMod;

interface IVersionOptionProps {
  t: TFunction;
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
  modsWithState: { [id: string]: IModWithState };
  groupedMods: { [id: string]: IModWithState[] };
  primaryMods: { [id: string]: IModWithState };
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
  private mAttributes: ITableAttribute[];
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
            ? (['downloaded', 'installed']
                .indexOf(this.state.modsWithState[instanceId].state) !== -1)
            : true,
        hotKey: { code: 46 },
        // remove is usually the default option for the menu, please put stuff above
        // it only if it really makes more sense as the default
        position: 5,
      },
      {
        icon: 'refresh',
        title: 'Check for Update',
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
        condition: this.conditionNotInstalled,
        position: 50,
      },
      {
        icon: 'start-install',
        title: 'Unpack (as-is)',
        action: this.installAsIs,
        condition: this.conditionNotInstalled,
        position: 55,
      },
      {
        icon: 'start-install',
        title: 'Reinstall',
        action: this.reinstall,
        condition: (instanceId: string | string[]) => {
          const cond = (id: string) => (this.props.mods[id] !== undefined)
              && (truthy(this.props.mods[id].archiveId));
          const res: boolean = (typeof(instanceId) === 'string')
            ? cond(instanceId)
            : instanceId.find(cond) !== undefined;
          return res
            ? true
            : this.props.t('No associated archive.') as string;
        },
        position: 60,
      },
    ];

    this.staticButtons = [
      {
        component: InstallArchiveButton,
        position: 25,
        props: () => ({}),
      },
      {
        component: CheckModVersionsButton,
        position: 50,
        props: () => ({groupedMods: this.state.groupedMods}),
      },
    ];

    this.mAttributes = [
      PICTURE,
      this.modEnabledAttribute,
      this.modNameAttribute,
      this.modVersionAttribute,
      this.modAuthorAttribute,
      this.modVersionDetailAttribute,
      this.modVariantDetailAttribute,
      INSTALL_TIME(() => this.context.api.locale()),
      ENABLED_TIME(() => this.context.api.locale()),
    ]
    .map((attr, idx) => ({ ...attr, position: (idx + 1) * 10 }));

    this.mUpdateDebouncer = new Debouncer((newProps) => {
        this.updateModsWithState(newProps)
          .then(() => null);
        return null;
      }, 500);

    this.initState({
      modsWithState: {},
      groupedMods: {},
      primaryMods: {},
    });
  }

  public componentDidMount() {
    this.mIsMounted = true;
    this.updateModsWithState(this.props)
    .then(() => this.forceUpdate());
  }

  public setBoundsRef = ref => {
    if (ref !== null) {
      this.mRef = ReactDOM.findDOMNode(ref) as Element;
      this.forceUpdate();
    }
  }

  public componentWillUnmount() {
    this.mIsMounted = false;
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
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

    if (this.state.groupedMods === undefined) {
      return null;
    }

    let content: JSX.Element;

    if (Object.keys(this.state.primaryMods).length === 0) {
      // for some reason I can't use the <Panel> control, it ends up
      // having no body
      content = (
        <div className='panel'>
          <div className='panel-body'>
            <EmptyPlaceholder
              icon='folder-download'
              fill={true}
              text={t('You don\'t have any installed mods')}
              subtext={this.renderMoreModsLink(modSources)}
            />
          </div>
        </div>
      );
    } else {
      content = (
        <Panel>
          <Panel.Body>
            <SuperTable
              tableId='mods'
              detailsTitle={t('Mod Attributes')}

              data={this.state.primaryMods}
              staticElements={this.mAttributes}
              actions={this.modActions}
            >
              <div id='more-mods-container'>
                {this.renderMoreMods(modSources)}
              </div>
            </SuperTable>
          </Panel.Body>
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
            <FlexLayout.Flex className='mod-list-container'>
              {content}
            </FlexLayout.Flex>
            <FlexLayout.Fixed className='mod-drop-container'>
              <Panel
                className='mod-drop-panel'
                expanded={showDropzone}
                onToggle={nop}
              >
                <Panel.Collapse>
                  <Panel.Body>
                    <Dropzone
                      accept={['files']}
                      drop={this.dropMod}
                      icon='folder-download'
                      clickable={false}
                    />
                  </Panel.Body>
                </Panel.Collapse>
                <CollapseIcon
                  position='topright'
                  onClick={this.toggleDropzone}
                  visible={showDropzone}
                />
              </Panel>
            </FlexLayout.Fixed>
          </FlexLayout>
        </MainPage.Body>
      </MainPage>
    );
  }

  private renderMoreMods(sources: IModSource[]): JSX.Element {
    const { t } = this.props;

    const filtered = sources.filter(source => {
      if ((source.options === undefined) || (source.options.condition === undefined)) {
        return true;
      }
      return source.options.condition();
    });

    if (filtered.length === 1) {
      return (
        <Button
          id='btn-more-mods'
          onClick={filtered[0].onBrowse}
          bsStyle='ghost'
        >
          {this.sourceIcon(filtered[0])}
          {t('Get more mods')}
        </Button>
      );
    }

    return (
      <DropdownButton
        id='btn-more-mods'
        title={t('Get more mods')}
        container={this.mRef}
        bsStyle='ghost'
      >
        {filtered.map(this.renderModSource)}
      </DropdownButton>
    );
  }

  private renderMoreModsLink(sources: IModSource[]): JSX.Element {
    const { t } = this.props;

    const filtered = sources.filter(source => {
      if ((source.options === undefined) || (source.options.condition === undefined)) {
        return true;
      }
      return source.options.condition();
    });

    const text = t('But don\'t worry, I know a place...');

    if (filtered.length === 1) {
      return (
        <a onClick={this.getMoreMods}>
          {text}
        </a>
      );
    }

    return (
      <DropdownButton
        id='btn-more-mods'
        title={text}
        container={this.mRef}
        bsStyle='link'
      >
        {filtered.map(this.renderModSource)}
      </DropdownButton>
    );
  }

  private sourceIcon(source: IModSource) {
    return (source.options !== undefined) && (source.options.icon !== undefined)
      ? <Icon name={source.options.icon} />
      : null;
  }

  private renderModSource = (source: IModSource) => {
    return (
      <MenuItem key={source.id} onSelect={source.onBrowse}>
        {this.sourceIcon(source)}
        {source.name}
      </MenuItem>
    );
  }

  private getMoreMods = () => {
    if (this.props.modSources.length > 0) {
      this.props.modSources[0].onBrowse();
    }
  }

  private calcVersion = (mod: IModWithState): string => {
    const { t } = this.props;
    const version = getSafe(mod.attributes, ['version'], undefined);
    const equalMods = this.state.groupedMods[mod.id];
    if ((equalMods !== undefined) && (equalMods.length > 1)) {
      return version + ' (' + t('{{ count }} more', { count: equalMods.length - 1 }) + ')';
    } else {
      return version;
    }
  }

  private renderVersion = (mod: IModWithState): JSX.Element => {
    const { downloads, downloadPath, mods, t, gameMode } = this.props;
    const equalMods = this.state.groupedMods[mod.id];
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
          mod={this.state.modsWithState[altId]}
          onRemove={this.removeSelectedMod}
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
      noShrink: true,
      isSortable: false,
      isGroupable: true,
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
      isGroupable: (mod: IModWithState, t: TFunction) => {
        if (mod === undefined) {
          return '';
        }
        const state = modUpdateState(mod.attributes);
        if (state === 'current') {
          return t('Up-to-date');
        } else {
          return t('Update available');
        }
      },
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
      calc: mod => {
        const authors = [];
        if (mod.attributes?.author !== undefined) {
          authors.push(mod.attributes.author);
        }
        if (mod.attributes?.uploader !== undefined) {
          authors.push(mod.attributes.uploader);
        }
        return authors.join(' & ');
      },
      customRenderer: (mod: IModWithState, detailCell: boolean, t: TFunction) => detailCell
        ? (<Author t={t} gameId={this.props.gameMode} mod={mod} />)
        : (<>{mod.attributes?.author || ''}</>),
      placement: 'both',
      isToggleable: true,
      isGroupable: true,
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
        newModsWithState[modId] = this.state.modsWithState[modId];
      }
    });

    // insert downloads. Since this requires deriving mod attributes from
    // the source-specific data we need to do this asynchronously although
    // we expect all attributes to be available instantaneous.
    return Promise.map(Object.keys(newProps.downloads), archiveId => {
      if ((getDownloadGames(newProps.downloads[archiveId]).indexOf(gameMode) !== -1)
        && (newProps.downloads[archiveId].state === 'finished')
        && !installedIds.has(archiveId)) {
        if ((oldProps.downloads[archiveId] === newProps.downloads[archiveId])
          && (this.state.modsWithState[archiveId] !== undefined)) {
          newModsWithState[archiveId] = this.state.modsWithState[archiveId];
          return;
        }
        return filterModInfo({
          download: newProps.downloads[archiveId],
          meta: newProps.downloads[archiveId]?.modInfo?.meta,
        }, undefined)
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
        if (!changed && ((this.state.modsWithState === undefined)
            || !_.isEqual(Object.keys(newModsWithState), Object.keys(this.state.modsWithState)))) {
          changed = true;
        }

        if (changed || (this.state.groupedMods === undefined)) {
          this.updateModGrouping(newModsWithState);
        }

        // assign only after mod grouping is updated so these don't go out of sync
        this.nextState.modsWithState = newModsWithState;
        this.mLastUpdateProps = newProps;
        return null;
      });
  }

  private cycleModState(profileId: string, modId: string, newValue: string) {
    const { gameMode, onSetModEnabled } = this.props;

    if (this.state.modsWithState[modId].state === 'downloaded') {
      // cycle from "not installed" -> "disabled"
      this.context.api.events.emit('start-install-download', modId);
    } else {
      // enabled and disabled toggle to each other so the toggle
      // will never remove the mod
      if (this.state.modsWithState[modId].enabled === true) {
        onSetModEnabled(profileId, modId, false);
      } else {
        onSetModEnabled(profileId, modId, true);
      }
      this.context.api.events.emit('mods-enabled', [modId], newValue, gameMode);
    }
  }

  private setModState(profileId: string, modId: string, value: string) {
    const { gameMode, onSetModEnabled } = this.props;
    const { modsWithState } = this.state;
    if (modsWithState[modId] === undefined) {
      return;
    }
    // direct selection
    if (value === 'uninstalled') {
      // selected "not installed"
      if (modsWithState[modId].state !== 'downloaded') {
        this.removeMods([modId])
        .then(() => null)
        .catch(UserCanceled, () => null)
        .catch(ProcessCanceled, err => {
          this.context.api.sendNotification({
            id: 'cant-remove-mod',
            type: 'warning',
            title: 'Failed to remove "{{modName}}"',
            message: err.message,
            replace: {
              modName: modName(modsWithState[modId]),
            },
          });
        })
        .catch(err => {
          // Activation store can potentially provide an err.allowReport value
          //  if/when the manifest is corrupted - we're going to suppress the
          //  report button for that use case.
          this.context.api.showErrorNotification('Failed to set mod to uninstalled', err,
            { allowReport: (err?.allowReport !== false) });
        });
      }
    } else if (modsWithState[modId].state === 'downloaded') {
      // selected "enabled" or "disabled" from "not installed" so first the mod
      // needs to be installed
      this.context.api.events.emit('start-install-download', modId, false, (err, id) => {
        if (value === 'enabled') {
          onSetModEnabled(profileId, id, true);
          this.context.api.events.emit('mods-enabled', [modId], value, gameMode);
        }
      });
    } else {
      // selected "enabled" or "disabled" from the other one
      onSetModEnabled(profileId, modId, value === 'enabled');
      this.context.api.events.emit('mods-enabled', [modId], value, gameMode);
    }
  }

  private changeModEnabled = (mod: IModWithState, value: any) => {
    const { profileId } = this.props;

    if ((this.state.modsWithState[mod.id] === undefined)
        || (this.state.modsWithState[mod.id].state === 'installing')) {
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

    this.nextState.primaryMods = Object.keys(groupedMods).reduce(
      (prev: { [id: string]: IModWithState }, value) => {
        const prim = groupedMods[value][0];
        prev[value] = prim;
        return prev;
      }, {});

    // assign after primary mods are calculated so that in case of an error the two don't become
    // out of sync
    this.nextState.groupedMods = groupedMods;
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
    const { gameMode, profileId, onSetModEnabled } = this.props;
    const { modId, altId } = evtKey;

    if (modId === altId) {
      return;
    }

    onSetModEnabled(profileId, modId, false);
    if ((this.state.modsWithState[altId] !== undefined)
        && (this.state.modsWithState[altId].state === 'downloaded')) {
      this.context.api.events.emit('start-install-download', altId, true, (err, id) => {
        if (err === null) {
          onSetModEnabled(profileId, id, true);
        }
      });
    } else {
      onSetModEnabled(profileId, altId, true);
    }

    this.context.api.events.emit('mods-enabled', [modId], false, gameMode);
    this.context.api.events.emit('mods-enabled', [altId], true, gameMode);
  }

  private enableSelected = (modIds: string[]) => {
    const { gameMode, profileId, modState } = this.props;

    modIds.forEach((key: string) => {
      if (!getSafe(modState, [key, 'enabled'], false)) {
        this.setModState(profileId, key, 'enabled');
      }
    });
    this.context.api.events.emit('mods-enabled', modIds, true, gameMode);
  }

  private disableSelected = (modIds: string[]) => {
    const { gameMode } = this.props;
    this.disableModsInner(modIds);
    this.context.api.events.emit('mods-enabled', modIds, false, gameMode);
  }

  private disableModsInner(modIds: string[]) {
    const { profileId, modState, onSetModEnabled } = this.props;
    modIds.forEach(key => {
      if (getSafe(modState, [key, 'enabled'], false)) {
        onSetModEnabled(profileId, key, false);
      }
    });
  }

  private removeMod(modId: string): Promise<void> {
    const { gameMode } = this.props;
    return new Promise((resolve, reject) => {
      this.context.api.events.emit('remove-mod', gameMode, modId, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private removeMods(modIds: string[]): Promise<void> {
    const { gameMode } = this.props;
    const { modsWithState } = this.state;

    if (modIds.length === 0) {
      return Promise.resolve();
    }

    const notiParams: INotification = {
      type: 'activity',
      title: 'Removing mods',
      message: '...',
    };

    notiParams.id = this.context.api.sendNotification({
      ...notiParams,
      progress: 0,
    });

    return Promise
      .mapSeries(modIds, (modId: string, idx: number, length: number) => {
        this.context.api.sendNotification({
          ...notiParams,
          message: modId,
          progress: (idx * 100) / length,
        });
        if ((modsWithState[modId] !== undefined)
            && (modsWithState[modId].state === 'installed')) {
          return this.removeMod(modId);
        } else {
          return Promise.resolve();
        }
      })
      .then(() => {
        this.context.api.events.emit('mods-enabled', modIds, false, gameMode);
      })
      .finally(() => {
        this.context.api.dismissNotification(notiParams.id);
      });
  }

  private removeSelectedMod = (modId: string) => {
    this.removeSelected([modId]);
  }

  private removeSelected = (modIds: string[]) => {
    const { t, gameMode, onRemoveMod, onShowDialog } = this.props;

    let removeMods: boolean;
    let removeArchive: boolean;

    const filteredIds = modIds
      .filter(modId => this.state.modsWithState[modId] !== undefined)
      .filter(modId =>
        ['downloaded', 'installed'].indexOf(this.state.modsWithState[modId].state) !== -1);

    if (filteredIds.length === 0) {
      return;
    }

    let allArchives = true;
    const modNames = filteredIds
      .map(modId => {
        let name = modName(this.state.modsWithState[modId], {
          version: true,
        });
        if (this.state.modsWithState[modId].state === 'downloaded') {
          name += ' ' + t('(Archive only)');
        } else {
          allArchives = false;
        }
        return name;
    });

    const checkboxes = allArchives
      ? [ { id: 'archive', text: t('Delete Archive'), value: true } ]
      : [
        { id: 'mod', text: t('Remove Mod'), value: true },
        { id: 'archive', text: t('Delete Archive'), value: false },
      ];

    onShowDialog('question', 'Confirm removal', {
      message: t('Do you really want to remove this mod?',
        { count: filteredIds.length, replace: { count: filteredIds.length } })
        + '\n' + modNames.join('\n'),
      checkboxes,
    }, [ { label: 'Cancel' }, { label: 'Remove' } ])
      .then((result: IDialogResult) => {
        removeMods = result.action === 'Remove' && result.input.mod;
        removeArchive = result.action === 'Remove' && result.input.archive;

        const wereInstalled = filteredIds
          .filter(key => (this.state.modsWithState[key] !== undefined)
                && (this.state.modsWithState[key].state === 'installed'));

        const archiveIds = filteredIds
          .filter(key => (this.state.modsWithState[key] !== undefined)
                      && (this.state.modsWithState[key].archiveId !== undefined))
          .map(key => this.state.modsWithState[key].archiveId);

        return (removeMods
            ? this.removeMods(wereInstalled)
              .then(() => wereInstalled.forEach(key => onRemoveMod(gameMode, key)))
            : Promise.resolve())
          .then(() => {
            if (removeArchive) {
              archiveIds.forEach(archiveId => {
                this.context.api.events.emit('remove-download', archiveId);
              });
            }
            return Promise.resolve();
          });
      })
      .catch(ProcessCanceled, err => {
        this.context.api.sendNotification({
          id: 'cant-remove-mod',
          type: 'warning',
          title: 'Failed to remove mods',
          message: err.message,
        });
      })
      .catch(UserCanceled, () => null)
      .catch(err => {
        this.context.api.showErrorNotification('Failed to remove selected mods', err);
      });
  }

  private install = (archiveIds: string | string[]) => {
    if (Array.isArray(archiveIds)) {
      archiveIds.forEach(archiveId =>
        this.context.api.events.emit('start-install-download', archiveId));
    } else {
      this.context.api.events.emit('start-install-download', archiveIds);
    }
  }

  private installAsIs = (archiveIds: string | string[]) => {
    if (Array.isArray(archiveIds)) {
      archiveIds.forEach(archiveId =>
        this.context.api.events.emit('start-install-download', archiveId, undefined, undefined, 'fallback'));
    } else {
      this.context.api.events.emit('start-install-download', archiveIds, undefined, undefined, 'fallback');
    }
  }

  private reinstall = (modIds: string | string[]) => {
    const { gameMode, mods, modState } = this.props;
    if (Array.isArray(modIds)) {
      modIds.filter(modId => mods[modId] !== undefined).forEach(modId =>
        this.context.api.events.emit('start-install-download', mods[modId].archiveId,
                                     false, (err) => {
          if (err === null) {
            const enabled = modIds.filter(id => getSafe(modState, [id, 'enabled'], false));
            if (enabled.length > 0) {
              this.context.api.events.emit('mods-enabled', enabled, true, gameMode);
            }
          }
        }));
    } else if (mods[modIds] !== undefined) {
      this.context.api.events.emit('start-install-download', mods[modIds].archiveId,
                                   false, (err) => {
        if (err === null) {
          if (modState[modIds].enabled) {
            // reinstalling an enabled mod automatically enables the new one so we also need
            // to trigger this event
            this.context.api.events.emit('mods-enabled', [modIds], true, gameMode);
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

    this.context.api.emitAndAwait('check-mods-version', gameMode, _.pick(mods, modIds), 'silent')
      .then(() => {
        this.context.api.sendNotification({
          type: 'success',
          message: 'Check for mod updates complete',
          displayMS: 5000,
        });
      });
  }

  private dropMod = (type: DropType, values: string[]) => {
    this.context.api.events.emit('import-downloads', values);
  }

  private conditionNotInstalled = (instanceId: string | string[]) => {
    const { mods } = this.props;
    if (typeof (instanceId) === 'string') {
      return mods[instanceId] === undefined;
    } else {
      return instanceId.find(id => mods[id] !== undefined) === undefined;
    }
  }
}

const empty = {};

function mapStateToProps(state: IState): IConnectedProps {
  const profile = selectors.activeProfile(state);
  const gameMode = selectors.activeGameId(state);

  return {
    mods: getSafe(state, ['persistent', 'mods', gameMode], empty),
    modState: getSafe(profile, ['modState'], empty),
    downloads: getSafe(state, ['persistent', 'downloads', 'files'], empty),
    gameMode,
    profileId: getSafe(profile, ['id'], undefined),
    language: state.settings.interface.language,
    installPath: selectors.installPath(state),
    downloadPath: selectors.downloadPath(state),
    showDropzone: state.settings.mods.showDropzone,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
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
  translate(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(
      ModList)) as React.ComponentClass<{}>;
