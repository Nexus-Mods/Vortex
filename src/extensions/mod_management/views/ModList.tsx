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
import ZoomableImage from '../../../controls/ZoomableImage';
import { IActionDefinition } from '../../../types/IActionDefinition';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../../types/IDialog';
import { IState } from '../../../types/IState';
import { ITableAttribute } from '../../../types/ITableAttribute';
import { withBatchContext } from '../../../util/BatchContext';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { ProcessCanceled, UserCanceled } from '../../../util/CustomErrors';
import Debouncer from '../../../util/Debouncer';
import * as selectors from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';
import { batchDispatch, bytesToString, toPromise, truthy } from '../../../util/util';
import MainPage from '../../../views/MainPage';

import calculateFolderSize from '../../../util/calculateFolderSize';

import getDownloadGames from '../../download_management/util/getDownloadGames';
import { setModEnabled, setModsEnabled } from '../../profile_management/actions/profiles';
import { IProfileMod } from '../../profile_management/types/IProfile';

import { removeMod, setModAttribute } from '../actions/mods';
import { setShowModDropzone } from '../actions/settings';
import { IInstallOptions } from '../types/IInstallOptions';
import { IMod } from '../types/IMod';
import { IModProps } from '../types/IModProps';
import { IModSource } from '../types/IModSource';
import combineMods from '../util/combine';
import filterModInfo from '../util/filterModInfo';
import groupMods from '../util/modGrouping';
import modName from '../util/modName';
import modUpdateState, { isIdValid, UpdateState } from '../util/modUpdateState';
import { removeMods } from '../util/removeMods';
import VersionFilter from '../util/VersionFilter';
import VersionChangelogButton from '../views/VersionChangelogButton';
import VersionIconButton from '../views/VersionIconButton';

import { DOWNLOAD_TIME, ENABLED_TIME, INSTALL_TIME } from '../modAttributes';
import getText from '../texts';

import Author from './Author';
import CheckModVersionsButton from './CheckModVersionsButton';
import Description from './Description';
import InstallArchiveButton from './InstallArchiveButton';

import Promise from 'bluebird';
import { TFunction } from 'i18next';
import * as _ from 'lodash';
import path from 'path';
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
          {variant !== undefined ? ` (${variant})` : ` (${t('default')})`}
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
  autoInstall: boolean;
  // some mod actions are not allowed while installing dependencies/collections
  //  e.g. combining a mod with other patch mods while the collection is still installing.
  suppressModActions: boolean;
}

interface IActionProps {
  onSetModAttribute: (gameMode: string, modId: string, attributeId: string, value: any) => void;
  onSetModsEnabled: (profileId: string, modIds: string[], enabled: boolean) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
  onRemoveMods: (gameMode: string, modIds: string[]) => void;
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
  private modPictureAttribute: ITableAttribute;
  private modVersionAttribute: ITableAttribute;
  private modVersionDetailAttribute: ITableAttribute;
  private modRevisionDetailAttribute: ITableAttribute;
  private modVariantDetailAttribute: ITableAttribute;
  private modArchiveNameAttribute: ITableAttribute;
  private modSizeAttribute: ITableAttribute;
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
        icon: 'delete',
        title: 'Remove related',
        action: this.removeRelated,
        condition: () => this.state.groupedMods !== undefined,
        singleRowAction: true,
        multiRowAction: false,
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
          if (this.conditionNotInstalled(instanceId)) {
            return false;
          }
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
      {
        icon: 'merge',
        title: 'Combine',
        condition: this.canBeCombined,
        action: this.combine,
        multiRowAction: true,
        singleRowAction: false,
        position: 70,
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
      this.modPictureAttribute,
      this.modEnabledAttribute,
      this.modNameAttribute,
      this.modVersionAttribute,
      this.modAuthorAttribute,
      this.modArchiveNameAttribute,
      this.modVersionDetailAttribute,
      this.modRevisionDetailAttribute,
      this.modVariantDetailAttribute,
      this.modSizeAttribute,
      INSTALL_TIME(() => this.context.api.locale()),
      ENABLED_TIME(() => this.context.api.locale()),
      DOWNLOAD_TIME(() => this.context.api),
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
      if (source.onBrowse === undefined) {
        return false;
      }
      if ((source.options?.condition === undefined)) {
        return true;
      }
      return source.options.condition();
    });

    const onGetMoreMods = () => {
      this.context.api.events.emit('analytics-track-click-event', 'Mods', 'Get more mods');
      if (filtered.length === 1) {
        filtered[0].onBrowse();
      }
    };

    if (filtered.length === 1) {
      return (
        <Button
          id='btn-more-mods'
          onClick={onGetMoreMods}
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
        onClick={onGetMoreMods}
      >
        {filtered.map(this.renderModSource)}
      </DropdownButton>
    );
  }

  private renderMoreModsLink(sources: IModSource[]): JSX.Element {
    const { t } = this.props;

    const filtered = sources.filter(source => {
      if (source.onBrowse === undefined) {
        return false;
      }
      if (source.options?.condition === undefined) {
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
    const browseable = this.props.modSources.find(iter => iter.onBrowse !== undefined);
    if (browseable !== undefined) {
      browseable.onBrowse();
    }
    this.context.api.events.emit('analytics-track-click-event', 'Collections', 'Add mods - empty');
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
            + (variant !== undefined ? ` (${variant})` : ` (${t('default')})`)
          }
          id={`version-dropdown-${mod.id}`}
          container={this.mRef}
        >
          {alternatives.map(altId => this.renderVersionOptions(mod.id, altId))}
        </DropdownButton>
      ) : null;

    return (
      <div className={'mod-update ' + this.updateClass(updateState, isIdValid(mod))}>
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

  private updateClass(state: UpdateState, valid: boolean) {
    if (!valid) {
      return 'invalid';
    }

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
      isExtensible: true,
      placement: 'both',
      isToggleable: false,
      edit: {
        readOnly: (mod: IModWithState) => mod.state === 'downloaded',
        onChangeValue: (mod: IModWithState, value: any) =>
          this.props.onSetModAttribute(this.props.gameMode, mod.id, 'customFileName', value),
      },
      isSortable: true,
      isDefaultFilter: true,
      isDefaultSort: true,
      filter: new TextFilter(true),
      position: 25,
      sortFunc: (lhs: string, rhs: string, locale: string): number => {
        if ((collator === undefined) || (locale !== lang)) {
          lang = locale;
          collator = new Intl.Collator(locale, { sensitivity: 'base' });
        }
        return collator.compare(lhs, rhs);
      },
    };

    this.modPictureAttribute = {
      id: 'picture',
      description: 'A picture provided by the author',
      customRenderer: (mod: IModWithState, detail: boolean, t: TFunction) => {
        const long = getSafe(mod, ['attributes', 'description'], '');
        const short = getSafe(mod, ['attributes', 'shortDescription'], '');

        const url = getSafe(mod, ['attributes', 'pictureUrl'], undefined);
        return (
          <ZoomableImage className='mod-picture' url={url}>
            <Description
              t={t}
              long={long}
              short={short}
              modId={mod.id}
              source={mod.attributes?.source}
              installed={mod.state === 'installed'}
              startEditDescription={this.editDescription}
            />
          </ZoomableImage>
        );
      },
      calc: mod => getSafe(mod.attributes, ['pictureUrl'], ''),
      placement: 'detail',
      edit: {},
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
      position: 5,
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
        { value: true, label: this.props.t('Enabled') },
        { value: false, label: this.props.t('Disabled') },
        { value: null, label: this.props.t('Uninstalled') },
      ], true),
    };

    this.modArchiveNameAttribute = {
      id: 'archiveName',
      name: 'Archive Name',
      description: 'The name of the archive used to install this mod',
      help: getText('archivename', this.props.t),
      calc: (mod: IModWithState) => {
        const download = this.props.downloads[mod.archiveId];
        return (download?.localPath !== undefined) ? download.localPath : '';
      },
      placement: 'both',
      isToggleable: true,
      isGroupable: true,
      isDefaultVisible: false,
      isSortable: true,
      filter: new TextFilter(true),
      edit: {},
    };

    this.modVersionDetailAttribute = {
      id: 'versionDetail',
      name: 'Version',
      description: 'File version (according to the author)',
      help: getText('version', this.props.t),
      icon: 'cake',
      calc: (mod: IModWithState) => (mod.type !== 'collection')
        ? getSafe(mod.attributes, ['version'], '')
        : undefined,
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

    this.modRevisionDetailAttribute = {
      id: 'revisionDetail',
      name: 'Revision',
      description: 'Collection revision',
      help: getText('version', this.props.t),
      icon: 'cake',
      calc: (mod: IModWithState) => (mod.type === 'collection')
        ? getSafe(mod.attributes, ['version'], '')
        : undefined,
      placement: 'detail',
      isToggleable: false,
      edit: {},
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

    this.modSizeAttribute = {
      id: 'modSize',
      name: 'Mod Size',
      description: 'The total size of the mod',
      icon: 'chart-bars',
      customRenderer: (mod: IModWithState) => {
        if (mod.state !== 'installed') {
          const download = this.props.downloads?.[mod.archiveId];
          return (
            <>
              {download?.size !== undefined ? bytesToString(download.size) : '???'}
            </>
          );
        }
        const value = mod.attributes.modSize !== undefined
          ? bytesToString(mod.attributes.modSize)
          : 'Calculate';
        return (
          <a
            className='control-label'
            onClick={this.setModSize}
            data-modid={mod.id}
            title='Click to calculate'
          >
            {value}
          </a>
        );
      },
      calc: (mod: IModWithState) => {
        if (mod.state !== 'installed') {
          const download = this.props.downloads?.[mod.archiveId];
          return download?.size ?? -1;
        }
        return mod.attributes?.modSize ?? -1;
      },
      placement: 'table',
      isDefaultVisible: false,
      isToggleable: true,
      edit: {},
      isSortable: true,
    };

    this.modAuthorAttribute = {
      id: 'author',
      name: 'Author',
      description: 'Author of the mod',
      icon: 'author',
      calc: mod => {
        const authors = new Set<string>();
        if (mod.attributes?.author !== undefined) {
          authors.add(mod.attributes.author);
        }
        if (mod.attributes?.uploader !== undefined) {
          authors.add(mod.attributes.uploader);
        }
        return Array.from(authors).join(' & ');
      },
      customRenderer: (mod: IModWithState, detailCell: boolean, t: TFunction) => detailCell
        ? (<Author t={t} gameId={this.props.gameMode} mod={mod} />)
        : (<>{mod.attributes?.author || ''}</>),
      placement: 'both',
      isToggleable: true,
      isGroupable: true,
      isDefaultVisible: false,
      isSortable: true,
      filter: new TextFilter(true),
      sortFunc: (lhs: string, rhs: string) =>
        lhs.localeCompare(rhs, this.props.language, { caseFirst: 'false' }),
      edit: {},
    };
  }

  private setModSize = (evt: React.MouseEvent<any>) => {
    const modId = evt.currentTarget.getAttribute('data-modid');
    const api = this.context.api;
    const stagingFolder = this.props.installPath;
    const mod = this.props.mods[modId];
    if (mod === undefined) {
      return Promise.resolve();
    }
    const modPath = path.join(stagingFolder, mod.installationPath);
    return calculateFolderSize(modPath)
    .then((totalSize) => {
      api.store.dispatch(setModAttribute(this.props.gameMode, mod.id, 'modSize', totalSize));
      return Promise.resolve();
    })
    .catch(err => {
      return Promise.resolve();
    });
  }

  private updateModsWithState(newProps: IProps): Promise<void> {
    const { gameMode } = newProps;
    let changed = false;
    const newModsWithState: { [modId: string]: IModWithState } = {};

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
            type: '',
            installationPath: undefined,
            enabled: null,
            enabledTime: 0,
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

  private cycleModState(modId: string) {
    if (this.state.modsWithState[modId].state === 'downloaded') {
      // cycle from "not installed" -> "disabled"
      this.context.api.events.emit('start-install-download', modId);
    } else {
      // enabled and disabled toggle to each other so the toggle
      // will never remove the mod
      const newState = this.state.modsWithState[modId].enabled !== true;
      this.setModsEnabled([modId], newState);
    }
  }

  private setModState(profileId: string, modId: string, value: string,
                      onSetModEnabled: (modId: string, value: boolean) => void)
                      : Promise<void> {
    const { gameMode } = this.props;
    const { modsWithState } = this.state;
    if (modsWithState[modId] === undefined) {
      return;
    }
    // direct selection
    if (value === 'uninstalled') {
      // selected "not installed"
      if (modsWithState[modId].state !== 'downloaded') {
        return removeMods(this.context.api, gameMode, [modId])
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
      return new Promise((resolve) => {
        this.context.api.events.emit('start-install-download', modId, false, (err, id) => {
          if ((err === null) && (value === 'enabled')) {
            this.setModsEnabled([id], true);
          }
          resolve();
        });
      });
    } else {
      // selected "enabled" or "disabled" from the other one
      this.setModsEnabled([modId], value === 'enabled');
    }

    return Promise.resolve();
  }

  private changeModEnabled = (mod: IModWithState, value: any) => {
    const { profileId } = this.props;

    if ((this.state.modsWithState[mod.id] === undefined)
        || (this.state.modsWithState[mod.id].state === 'installing')) {
      // can't change state while installing
      return;
    }

    if (value === undefined) {
      this.cycleModState(mod.id);
    } else {
      this.setModState(profileId, mod.id, value, (modId: string, enabled: boolean) =>
        this.setModsEnabled([modId], enabled));
    }
  }

  private updateModGrouping(modsWithState) {
    const modList = Object.keys(modsWithState).reduce((accum, key) => {
      const mod = modsWithState[key];
      if (mod) {
        accum.push(mod);
      }
      return accum;
    }, []);
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
    const { gameMode, profileId } = this.props;
    const { modId, altId } = evtKey;

    if (modId === altId) {
      return;
    }

    this.setModsEnabled([modId], false)
      .then(() => {
        if ((this.state.modsWithState[altId] !== undefined)
          && (this.state.modsWithState[altId].state === 'downloaded')) {
          this.context.api.events.emit('start-install-download', altId, true, (err, id) => {
            if (err === null) {
              this.setModsEnabled([id], true);
            }
          });
        } else {
          this.setModsEnabled([altId], true);
        }
      });
  }

  private editDescription = (modId: string) => {
    const { gameMode, mods } = this.props;

    if (mods[modId] === undefined) {
      // mod not installed, we shouldn't have gotten here
      return;
    }

    this.context.api.showDialog('question', 'Enter new description', {
      text: 'You can use bbcode here. If you put in two spaces, ',
      input: [{
        id: 'description',
        type: 'multiline',
        value: (mods[modId].attributes['description'] ?? '').replace(/<br\/>/g, '\n'),
      }],
    }, [
      { label: 'Cancel' },
      { label: 'Save' },
    ])
    .then(result => {
      if (result.action === 'Save') {
        let description = result.input['description'];
        const endShort = description.indexOf('\n\n');
        if (endShort !== -1) {
          this.props.onSetModAttribute(gameMode, modId, 'shortDescription',
                                       description.substring(0, endShort));
        }
        description = description.replace(/\n/g, '<br/>');
        this.props.onSetModAttribute(gameMode, modId, 'description', description);
      }
    });
  }

  private setModsEnabled(modIds: string[], enabled: boolean) {
    const { profileId } = this.props;
    return setModsEnabled(this.context.api, profileId, modIds, enabled);
  }

  private installIfNecessary(modId: string): Promise<string> {
    const { modsWithState } = this.state;

    if (modsWithState[modId]?.state === 'downloaded') {
      return toPromise(cb =>
        this.context.api.events.emit('start-install-download', modId, false, cb));
    } else {
      return Promise.resolve(modId);
    }
  }

  private enableSelected = (modIds: string[]) => {
    const { mods, modState } = this.props;

    const filtered = modIds.filter(modId =>
      (mods[modId] === undefined) || (modState[modId]?.enabled !== true));

    Promise.all(filtered.map(modId =>
      this.installIfNecessary(modId).catch(err => {
        if ((err instanceof UserCanceled)
            || (err instanceof ProcessCanceled)) {
          return;
        }
        const message = modName(this.state.modsWithState[modId]);
        this.context.api.showErrorNotification(
          'Failed to install mod', err,
          { allowReport: false, message });
      })))
      .then((updatedModIds: string[]) => this.setModsEnabled(updatedModIds, true));
  }

  private disableSelected = (modIds: string[]) => {
    const { mods, modState } = this.props;
    modIds = modIds.filter(modId =>
      (mods[modId] !== undefined) && (modState[modId]?.enabled === true));
    this.setModsEnabled(modIds, false);
  }

  private removeRelated = (modIds: string[]) => {
    if (this.state.groupedMods === undefined) {
      return;
    }
    const modId = Array.isArray(modIds) ? modIds[0] : modIds;
    const candidates: Array<{ mod: IMod, enabled: boolean }> =
      (this.state.groupedMods[modId] ?? [])
        .filter(mod => mod?.attributes !== undefined)
        .map(mod => ({ mod, enabled: mod.id !== modId }));

    const repoModId = this.state.modsWithState[modId]?.attributes?.modId?.toString?.();
    if (repoModId !== undefined) {
      const existing = new Set(candidates.map(cand => cand.mod.id));
      existing.add(modId);
      Object.keys(this.state.modsWithState)
        .filter(iter =>
            !existing.has(iter)
            && this.state.modsWithState[iter]?.attributes?.modId?.toString?.() === repoModId)
        .forEach(iter => {
          candidates.push({ mod: this.state.modsWithState[iter], enabled: false });
        });
    }

    if (candidates.length === 0) {
      this.context.api.showDialog('info', 'No mods to remove', {
        text: 'There are no other versions of this file',
      }, [{
        label: 'Close',
      }]);
      return;
    }

    this.context.api.showDialog('question', 'Select mods to remove', {
      text: 'Please select the mods to remove. This will remove them from all profiles!',
      checkboxes: candidates.map(candidate => ({
        id: '_' + candidate.mod.id,
        text: modName(candidate.mod, { version: true, variant: true }),
        value: candidate.enabled,
      })),
      choices: [
        { id: 'mods-only', value: true, text: 'Remove mod only' },
        { id: 'mods-and-archive', value: false, text: 'Remove mod and delete archive' },
      ],
    }, [
      { label: 'Cancel' },
      { label: 'Remove Selected' },
    ])
    .then(result => {
      if (result.action === 'Remove Selected') {
        const removeArchives = result.input['mods-and-archive'];
        const idsToRemove = Object.keys(result.input)
          .filter(key => key.startsWith('_'))
          .filter(key => result.input[key] === true)
          .map(key => key.slice(1));

        return this.removeSelectedImpl(idsToRemove, true, removeArchives);
      }
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

    return true;
  }

  private removeSelectedMod = (modId: string) => {
    this.removeSelected([modId]);
  }

  private removeSelectedImpl(modIds: string[], doRemoveMods: boolean, removeArchives: boolean) {
    const { gameMode, onRemoveMods } = this.props;
    const wereInstalled = modIds
      .filter(key => (this.state.modsWithState[key] !== undefined)
            && (this.state.modsWithState[key].state === 'installed'));

    const archiveIds = modIds
      .filter(key => (this.state.modsWithState[key] !== undefined)
                  && (this.state.modsWithState[key].archiveId !== undefined))
      .map(key => this.state.modsWithState[key].archiveId);

    return (doRemoveMods
        ? removeMods(this.context.api, gameMode, wereInstalled)
          .then(() => onRemoveMods(gameMode, wereInstalled))
        : Promise.resolve())
      .then(() => {
        if (removeArchives) {
          archiveIds.forEach(archiveId => {
            this.context.api.events.emit('remove-download', archiveId);
          });
        }
        return Promise.resolve();
      });
  }

  private removeSelected = (modIds: string[]) => {
    const { t, onShowDialog } = this.props;

    let doRemoveMods: boolean;
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
          variant: true,
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

    const insert = ' [style=dialog-danger-text]' + t('from all profiles') + '[/style]';

    onShowDialog('question', 'Confirm removal', {
      bbcode: t('Do you really want to remove this mod{{insert}}?', {
        count: filteredIds.length, replace: {
          insert,
        },
      }),
      message: modNames.join('\n'),
      checkboxes,
    }, [ { label: 'Cancel' }, { label: 'Remove' } ])
      .then((result: IDialogResult) => {
        doRemoveMods = result.action === 'Remove' && result.input.mod;
        removeArchive = result.action === 'Remove' && result.input.archive;

        return this.removeSelectedImpl(filteredIds, doRemoveMods, removeArchive);
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
      withBatchContext('install-mod', archiveIds, () => {
        return Promise.all(archiveIds.map(async archiveId => {
          return toPromise<string>(cb => this.context.api.events.emit('start-install-download', archiveId, {
            allowAutoEnable: false,
          }, cb)).catch(err => {
            if (err instanceof UserCanceled) {
              return Promise.resolve(null);
            }
          });
        })).then((modIds: string[]) => {
          const filtered = modIds.filter(modId => modId !== null);
          if (this.props.autoInstall && filtered.length > 0) {
            this.props.onSetModsEnabled(this.props.profileId, filtered, true);
          }
          return Promise.resolve();
        });
      })
    } else {
      this.context.api.events.emit('start-install-download', archiveIds);
    }
  }

  private installAsIs = (archiveIds: string | string[]) => {
    const options: IInstallOptions = {
      forceInstaller: 'fallback',
    };
    if (Array.isArray(archiveIds)) {
      archiveIds.forEach(archiveId =>
        this.context.api.events.emit('start-install-download', archiveId, options, undefined));
    } else {
      this.context.api.events.emit('start-install-download', archiveIds, options, undefined);
    }
  }

  private reinstall = (modIds: string | string[]) => {
    const { gameMode, mods, modState } = this.props;
    if (Array.isArray(modIds)) {
      const validIds = modIds.filter(modId => mods[modId] !== undefined);
      const installTimes = validIds.reduce((prev, modId) => {
        prev[modId] = mods[modId].attributes?.installTime;
        return prev;
      }, {});
      withBatchContext<void>('install-mod', validIds.map(modId => mods[modId].archiveId), () => {
        return Promise.all(
          validIds.map(modId => {
            const choices = getSafe(mods[modId], ['attributes', 'installerChoices'], undefined);
            const installOpts: IInstallOptions = choices !== undefined ? {
              choices, allowAutoEnable: false,
            } : {
              allowAutoEnable: false,
            };
            return toPromise(cb => this.context.api.events.emit('start-install-download',
                mods[modId].archiveId, installOpts, cb))
              .catch(err => {
                if (err instanceof UserCanceled) {
                  return;
                }
                this.context.api.showErrorNotification('Failed to reinstall mod', err, {
                  message: modName(mods[modId]),
                  allowReport: false,
                });
              });
          }))
          .then(() => {
            const newMods = this.props.mods;
            const enabled = validIds
              .filter(id => getSafe(modState, [id, 'enabled'], false))
              .filter(id => installTimes?.[id] !== newMods[id]?.attributes?.installTime);
            if (enabled.length > 0) {
              this.context.api.events.emit('mods-enabled', enabled, true, gameMode);
            }
          });
        });
    } else if (mods[modIds] !== undefined) {
      const choices = getSafe(mods[modIds], ['attributes', 'installerChoices'], undefined);
      this.context.api.events.emit('start-install-download', mods[modIds].archiveId,
                                   { choices, allowAutoEnable: false }, (err) => {
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

  private canBeCombined = (modIds: string[]) => {
    const { t, mods, suppressModActions } = this.props;

    const notInstalled = modIds.find(modId => mods[modId] === undefined);
    if (notInstalled !== undefined) {
      return t('You can only combine installed mods') ;
    }

    if (suppressModActions) {
      return t('Try again after installing dependencies');
    }

    return true;
  }

  private combine = (modIds: string[]) => {
    const { gameMode, suppressModActions } = this.props;
    const { api } = this.context;
    if (suppressModActions) {
      api.showErrorNotification('Try again after installing dependencies', 'Mod actions are currently disabled', { allowReport: false });
      return;
    }
    return combineMods(api, gameMode, modIds);
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
    const { autoInstall } = this.props;
    this.context.api.events.emit('import-downloads', values, (dlIds: string[]) => {
      if (autoInstall) {
        dlIds.forEach(dlId => {
          this.context.api.events.emit('start-install-download', dlId);
        });
      }
    });
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

const shouldSuppressModActions = (state: IState): boolean => {
  const suppressOnActivities = ['conflicts', 'installing_dependencies', 'deployment', 'purging'];
  const isActivityRunning = (activity: string) =>
    getSafe(state, ['session', 'base', 'activity', 'mods'], []).includes(activity) // purge/deploy
    || getSafe(state, ['session', 'base', 'activity', activity], []).length > 0; // installing_dependencies
  const suppressingActivities = suppressOnActivities.filter(activity => isActivityRunning(activity));
  const suppressing = suppressingActivities.length > 0;
  return suppressing;
}

function mapStateToProps(state: IState): IConnectedProps {
  const profile = selectors.activeProfile(state);
  const gameMode = selectors.activeGameId(state);
  const suppressModActions = shouldSuppressModActions(state);
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
    autoInstall: state.settings.automation.install,
    suppressModActions,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetModAttribute: (gameMode: string, modId: string, attributeId: string, value: any) => {
      dispatch(setModAttribute(gameMode, modId, attributeId, value));
    },
    onSetModsEnabled: (profileId: string, modIds: string[], enabled: boolean) => {
      batchDispatch(dispatch, modIds.map(modId => setModEnabled(profileId, modId, enabled)));
    },
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
    onRemoveMods: (gameMode: string, modIds: string[]) =>
      batchDispatch(dispatch, modIds.map(modId => removeMod(gameMode, modId))),
    onShowDropzone: (show: boolean) => dispatch(setShowModDropzone(show)),
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(
      ModList)) as React.ComponentClass<{}>;
