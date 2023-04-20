import { showDialog } from '../../../actions/notifications';
import Banner from '../../../controls/Banner';
import CollapseIcon from '../../../controls/CollapseIcon';
import Dropzone, { DropType } from '../../../controls/Dropzone';
import FlexLayout from '../../../controls/FlexLayout';
import IconBar from '../../../controls/IconBar';
import SuperTable, { ITableRowAction } from '../../../controls/Table';
import { IActionDefinition } from '../../../types/IActionDefinition';
import { IComponentContext } from '../../../types/IComponentContext';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../../types/IDialog';
import { IAttachment } from '../../../types/IExtensionContext';
import { IState } from '../../../types/IState';
import { ITableAttribute } from '../../../types/ITableAttribute';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { DataInvalid, ProcessCanceled, TemporaryError, UserCanceled } from '../../../util/CustomErrors';
import getVortexPath from '../../../util/getVortexPath';
import { log } from '../../../util/log';
import { showError } from '../../../util/message';
import opn from '../../../util/opn';
import * as selectors from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';
import MainPage from '../../../views/MainPage';

import { IGameStored } from '../../gamemode_management/types/IGameStored';
import { IInstallOptions } from '../../mod_management/types/IInstallOptions';

import { setShowDLDropzone, setShowDLGraph } from '../actions/settings';
import { finishDownload, setDownloadTime } from '../actions/state';
import { IDownload } from '../types/IDownload';
import getDownloadGames from '../util/getDownloadGames';

import { DownloadIsHTML } from '../DownloadManager';

import DownloadGraph from './DownloadGraph';

import Promise from 'bluebird';
import { TFunction } from 'i18next';
import _ from 'lodash';
import * as path from 'path';
import * as React from 'react';
import { Button, Panel } from 'react-bootstrap';
import { WithTranslation } from 'react-i18next';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

export interface IDownloadViewBaseProps extends WithTranslation {
  active: boolean;
  secondary: boolean;
  columns: (props: () => IDownloadViewProps) => Array<ITableAttribute<IDownload>>;
  downloadPathForGame: (game: string) => string;
}

interface IConnectedProps {
  downloads: { [downloadId: string]: IDownload };
  gameMode: string;
  knownGames: IGameStored[];
  downloadPath: string;
  showDropzone: boolean;
  showGraph: boolean;
  maxBandwidth: number;
}

type DownloadFinishState = 'finished' | 'failed' | 'redirect';

interface IActionProps {
  onSetAttribute: (id: string, time: number) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
  onShowError: (message: string, details?: string | Error,
                notificationId?: string, allowReport?: boolean,
                attachments?: IAttachment[]) => void;
  onShowDropzone: (show: boolean) => void;
  onShowGraph: (show: boolean) => void;
  onFinishDownload: (dlId: string, dlState: DownloadFinishState, failReason: string) => void;
}

export type IDownloadViewProps =
  IDownloadViewBaseProps & IConnectedProps & IActionProps & { t: TFunction };

interface IComponentState {
  viewAll: boolean;
}

const nop = () => null;

const DROPZONE_ACCEPT: DropType[] = ['urls', 'files'];

function MountTrigger(props: { cb: () => void }) {
  React.useCallback(() => {
    props.cb();
  }, []);
  return null;
}

class DownloadView extends ComponentEx<IDownloadViewProps, IComponentState> {
  public declare context: IComponentContext;
  private actions: ITableRowAction[];
  private mColumns: Array<ITableAttribute<IDownload>>;
  private mTableActions: IActionDefinition[];
  private mHeaderRendered: boolean = false;
  private mLastFiltered: { [dlId: string]: IDownload };

  constructor(props: IDownloadViewProps) {
    super(props);
    this.initState({
      viewAll: false,
    });

    this.actions = [
      {
        icon: 'inspect',
        title: 'Inspect',
        action: this.inspect,
        condition: this.inspectable,
        multiRowAction: false,
        options: {
          noCollapse: true,
        },
      },
      {
        icon: 'start-install',
        title: 'Install',
        action: this.install,
        condition: this.installable,
        hotKey: { code: 13 },
        options: {
          noCollapse: true,
        },
      },
      {
        icon: 'start-install',
        title: 'Unpack (as-is)',
        action: this.installAsIs,
        condition: this.installable,
      },
      {
        icon: 'pause',
        title: 'Pause',
        action: this.pause,
        condition: this.pausable,
      },
      {
        icon: 'resume',
        title: 'Resume',
        action: this.resume,
        condition: this.resumable,
      },
      {
        icon: 'resume',
        title: 'Retry',
        action: this.resume,
        condition: this.retryable,
      },
      {
        icon: 'delete',
        title: 'Delete',
        action: this.remove,
        condition: this.removable,
        hotKey: { code: 46 },
      },
      {
        icon: 'stop',
        title: 'Cancel',
        action: this.cancel,
        condition: this.cancelable,
      },
      {
        icon: 'open-ext',
        title: 'Open',
        action: this.open,
        condition: this.installable,
        singleRowAction: true,
      },
    ];

    this.mTableActions = [];
  }

  public shouldComponentUpdate(nextProps: IDownloadViewProps, nextState: IComponentState) {
    if (!this.mHeaderRendered) {
      // bit of a hack. The toolbar doesn't get rendered until the reference for the
      // portal target is initialized, until then we can't make the update dependent on just
      // the props
      return true;
    }
    return this.props.downloads !== nextProps.downloads
      || this.props.downloadPath !== nextProps.downloadPath
      || this.props.gameMode !== nextProps.gameMode
      || this.props.knownGames !== nextProps.knownGames
      || this.props.secondary !== nextProps.secondary
      || this.props.showDropzone !== nextProps.showDropzone
      || this.props.showGraph !== nextProps.showGraph
      || this.state.viewAll !== nextState.viewAll
    ;
  }

  public render(): JSX.Element {
    const { t, downloads, gameMode, maxBandwidth, secondary, showGraph } = this.props;
    const { viewAll } = this.state;

    if (this.mColumns === undefined) {
      this.mColumns = this.props.columns(() => this.props);
    }

    let content = null;

    let filteredIds = Object.keys(downloads);

    if ((filteredIds.length === 0) && (gameMode !== undefined)) {
      content = this.renderDropzone();
    } else {
      if (!viewAll) {
        filteredIds = filteredIds.filter(dlId => downloads[dlId].installed === undefined);
      }
      const filtered = filteredIds.reduce((prev, dlId) => {
        prev[dlId] = downloads[dlId];
        return prev;
      }, {});

      if (!_.isEqual(filtered, this.mLastFiltered)) {
        this.mLastFiltered = filtered;
      }

      content = (
        <FlexLayout type='column'>
          {secondary ? null : <Banner group='downloads' />}
          <FlexLayout.Flex className='download-list-container'>
            <Panel className='download-panel' >
              {secondary ? null : (
                <Panel
                  className='download-graph-panel'
                  expanded={showGraph}
                  onToggle={nop}
                >
                  <Panel.Body collapsible={true}>
                    <DownloadGraph t={t} maxBandwidth={maxBandwidth} />
                  </Panel.Body>
                  <CollapseIcon
                    position='bottomright'
                    onClick={this.toggleGraph}
                    visible={showGraph}
                  />
                </Panel>
              )}
              <Panel.Body>
                <FlexLayout type='column'>
                  <FlexLayout.Flex>
                    <SuperTable
                      tableId='downloads'
                      data={this.mLastFiltered}
                      staticElements={this.mColumns}
                      actions={this.actions}
                    />
                  </FlexLayout.Flex>
                  <FlexLayout.Fixed style={{ textAlign: 'center' }}>
                    <Button bsStyle='ghost' onClick={this.toggleViewAll} >
                      {viewAll ? t('View not-yet-installed Downloads') : t('View All Downloads')}
                    </Button>
                  </FlexLayout.Fixed>
                </FlexLayout>
              </Panel.Body>
            </Panel>
          </FlexLayout.Flex>
          <FlexLayout.Fixed className='download-drop-container'>
            {secondary || (gameMode === undefined) ? null : this.renderDropzone()}
          </FlexLayout.Fixed>
        </FlexLayout>
      );
    }

    return (
      <MainPage>
        <MainPage.Header>
          {this.mHeaderRendered ? null : <MountTrigger cb={this.wasRendered}/>}
          <IconBar
            group='download-actions'
            staticElements={this.mTableActions}
            className='menubar'
            t={t}
          />
        </MainPage.Header>
        <MainPage.Body>
          {content}
        </MainPage.Body>
      </MainPage>
    );
  }

  private wasRendered = () => {
    this.mHeaderRendered = true;
  }

  private renderDropzone(): JSX.Element {
    const { t, showDropzone } = this.props;
    return (
      <Panel
        className='download-drop-panel'
        expanded={showDropzone}
        onToggle={nop}
      >
        <Panel.Collapse>
          <Panel.Body>
            <Dropzone
              accept={DROPZONE_ACCEPT}
              drop={this.dropDownload}
              dialogHint={t('Enter download URL')}
              icon='folder-download'
            />
          </Panel.Body>
        </Panel.Collapse>
        <CollapseIcon
          position='topright'
          onClick={this.toggleDropzone}
          visible={showDropzone}
        />
      </Panel>
    );
  }

  private toggleViewAll = () => {
    this.nextState.viewAll = !this.state.viewAll;
  }

  private toggleDropzone = () => {
    const { showDropzone, onShowDropzone } = this.props;
    onShowDropzone(!showDropzone);
  }

  private toggleGraph = () => {
    const { showGraph, onShowGraph } = this.props;
    onShowGraph(!showGraph);
  }

  private getDownload(downloadId: string): IDownload {
    return this.props.downloads[downloadId];
  }

  private pause = (downloadIds: string[]) => {
    downloadIds.forEach((downloadId: string) => {
      this.context.api.events.emit('pause-download', downloadId);
    });
  }

  private pausable = (downloadIds: string[]) => {
    return downloadIds.find((downloadId: string) => {
      const download = this.getDownload(downloadId);
      return (download.state === 'started')
          && (download.pausable !== false);
    }) !== undefined;
  }

  private reportDownloadError(err: any, resume: boolean) {
    if (err === null) {
      return;
    }
    const urlInvalid = ['moved permanently', 'forbidden', 'gone'];
    const title = resume ? 'Failed to resume download' : 'Failed to start download';
    if (err instanceof ProcessCanceled) {
      this.props.onShowError(title, err, undefined, false);
    } else if (err instanceof UserCanceled) {
      // nop
    } else if ((err instanceof DataInvalid)
               || (err instanceof URIError)) {
       this.props.onShowError(title, err, undefined, false);
    } else if (err instanceof DownloadIsHTML) {
      if (resume) {
        this.props.onShowError(title,
          'Sorry, the download link is no longer valid. '
          + 'Please restart the download.',
          undefined, false);
      } // else nop
    } else if (((err.HTTPStatus !== undefined)
                && (urlInvalid.indexOf(err.HTTPStatus.toLowerCase()) !== -1))
               || (err.message === 'No download urls')) {
      this.props.onShowError(title,
        'Sorry, the download link is no longer valid. '
        + 'Please restart the download.',
        undefined, false);
    } else if (err instanceof TemporaryError) {
      this.props.onShowError(title,
        'Downloading failed due to an I/O error (either '
        + 'network or disk access). This is very likely a '
        + 'temporary problem, please try resuming at a later time.',
        undefined, false);
    } else if (err.code === 'ERR_SSL_WRONG_VERSION_NUMBER') {
      this.props.onShowError(title,
        'Vortex is pre-configured to meet the minimum required security protocol version '
          + 'when connecting to the Nexus Mods servers. This error signifies that somewhere along the '
          + 'network infrastructure your computer uses to connect to the servers, there '
          + 'was a security protocol version mismatch, which can only happen if the infrastructure is using '
          + 'outdated protocols - if you are connecting through a proxy server or via VPN, make '
          + 'sure they support the latest security protocols (TLS 1.2 at a minimum). '
          + 'If the issue persists - please contact our web development team directly as we '
          + '(Vortex support) cannot assist you in this matter.',
        undefined, false);
    } else if (err.message.match(/Protocol .* not supported/) !== null) {
      this.context.api.showErrorNotification(title,
        err.message, {
        allowReport: false,
      });
    } else if (err.code === 'EPROTO') {
      log('error', title, err.message);
      this.context.api.showErrorNotification(title,
        'The download failed due to a SSL protocol error. Protocol errors '
          + 'are generally due to a connectivity issue between your system and '
          + 'the Nexus Mods servers (usually a temporary issue). If this is '
          + 'happening consistently throughout an extensive period of time, '
          + 'please report this to the Nexus Mods web team or support@nexusmods.com '
          + '(NOT Vortex support).',
        { allowReport: false });
    } else if (err.code === 'CERT_HAS_EXPIRED') {
      this.context.api.showErrorNotification(title,
        'The download failed due to an SSL certificate expiring. The Nexus Mods certificate '
          + 'is renewed regularly weeks or months before expiration and is not the '
          + 'cause of this error. Please review the infrastructure (VPN, Proxy, etc) '
          + 'through which you are connecting to our servers and try again. Please '
          + 'note that some AntiVirus companies hijack the certificate chain as part of their '
          + '"protection" suite - which could also cause this error if their certificate expired',
        { allowReport: false });
    } else if (err.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
      this.context.api.showErrorNotification(title,
        'Nexus Mods does not use self-signed certificates. This error signifies that '
          + 'your network connection seems to be proxied, either by malware or '
          + 'a badly developed firewall, AV, VPN, http proxy; causing valid SSL '
          + 'certificates to not be recognized. Please review your system and its '
          + 'network connection before trying again.', { allowReport: false });
    } else if (err['code'] === 'ERR_UNESCAPED_CHARACTERS') {
      this.context.api.showErrorNotification(title,
        err.message, {
        allowReport: false,
        message: 'Invalid URL',
      });
    } else if (err.code === 'ECONNRESET') {
      this.props.onShowError(title,
        'Server closed the connection, please '
        + 'check your internet connection',
        undefined, false);
    } else if (err.code === 'ETIMEDOUT') {
      this.props.onShowError(title,
        'Connection timed out, please check '
        + 'your internet connection',
        undefined, false);
    } else if (err.code === 'ENOSPC') {
      this.props.onShowError(title, 'The disk is full', undefined, false);
    } else if (err.code === 'EBADF') {
      this.props.onShowError(title,
        'Failed to write to disk. If you use a removable media or '
        + 'a network drive, the connection may be unstable. '
        + 'Please try resuming once you checked.',
        undefined, false);
    } else if (err.code === 'Z_DATA_ERROR') {
      // this indicates the server didn't send gzipped data even though we requested that.
      // This was only observerd when resuming downloads from beatmods.com. It may be their
      // server or the server is reporting capabilities incorrectly or it does and we don't
      // support the config correctly
      this.props.onShowError(
        title,
        'Failed to resume download. This may be caused by a misconfiguration on the server '
        + 'or Vortex doesn\'t support resume on this server configuration. '
        + 'Apologies for the inconvenience.',
        undefined, false);
    } else if (err.message.indexOf('DECRYPTION_FAILED_OR_BAD_RECORD_MAC') !== -1) {
      this.props.onShowError(title,
        'Network communication error (SSL payload corrupted). '
        + 'This is likely a temporary issue, please try again later.',
        undefined, false);
    } else {
      err['attachLogOnReport'] = true;
      this.props.onShowError(title, err);
    }
  }

  private resume = (downloadIds: string[]) => {
    downloadIds.forEach((downloadId: string) => {
      this.context.api.events.emit('resume-download', downloadId, (err) => {
        if (err !== null) {
          this.openModPage(downloadId);
          this.reportDownloadError(err, true);
        }
      });
    });
  }

  private resumable = (downloadIds: string[]) => {
    return downloadIds.find((downloadId: string) => (
      this.getDownload(downloadId).state === 'paused'
    )) !== undefined;
  }

  private retryable = (downloadIds: string[]) => {
    return downloadIds.find((downloadId: string) => (
      this.getDownload(downloadId).state === 'failed'
    )) !== undefined;
  }

  private remove = (downloadIds: string[]) => {
    const removeId = (id: string) => {
      this.context.api.events.emit('remove-download', id);
    };

    const { t, onShowDialog } = this.props;

    const downloadNames = downloadIds
      .filter(downloadId => this.getDownload(downloadId) !== undefined)
      .map((downloadId: string) => (
      this.getDownload(downloadId).localPath
    ));

    onShowDialog('question', 'Confirm Deletion', {
      text: t('Do you really want to delete this archive?',
        { count: downloadIds.length, replace: { count: downloadIds.length } }),
      message: downloadNames.join('\n'),
      options: {
        translated: true,
      },
    }, [
        { label: 'Cancel' },
        { label: 'Delete', action: () => downloadIds.forEach(removeId) },
    ]);
  }

  private removable = (downloadIds: string[]) => {
    const match = ['finished', 'failed', undefined];
    return downloadIds.find((downloadId: string) => (
      match.includes(this.getDownload(downloadId).state)
    )) !== undefined;
  }

  private cancel = (downloadIds: string[]) => {
    const { t, onFinishDownload } = this.props;
    const paused = downloadIds.filter(dlId => this.getDownload(dlId)?.state === 'paused');
    const nonPaused = downloadIds.filter(dlId => this.getDownload(dlId)?.state !== 'paused');
    paused.forEach(dlId => onFinishDownload(dlId, 'failed',
      t('Download was canceled by the user')));
    if (nonPaused.length > 0) {
      this.remove(nonPaused);
    }
  }

  private cancelable = (downloadIds: string[]) => {
    const match = ['init', 'started', 'paused', 'redirect'];
    return downloadIds.find((downloadId: string) => (
      match.includes(this.getDownload(downloadId).state)
    )) !== undefined;
  }

  private install = (downloadIds: string[]) => {
    const { api } = this.context;
    downloadIds.forEach((dlId: string) => {
      // not reporting errors here, mod install errors are handled by the InstallManager
      api.events.emit('start-install-download', dlId, undefined, undefined);
    });
  }

  private installAsIs = (downloadIds: string[]) => {
    downloadIds.forEach((downloadId: string) => {
      const options: IInstallOptions = {
        forceInstaller: 'fallback',
      };
      this.context.api.events.emit(
        'start-install-download', downloadId, options, undefined);
    });
  }

  private installable = (downloadIds: string[]) => {
    return downloadIds.find(
      (id: string) => this.getDownload(id).state === 'finished') !== undefined;
  }

  private open = (downloadId: string) => {
    const { downloadPathForGame, downloads } = this.props;
    const download: IDownload = downloads[downloadId];
    if (download?.localPath !== undefined) {
      const downloadGame = getDownloadGames(download);

      if (downloadPathForGame(downloadGame[0]) === undefined) {
        // Not sure under what circumstances we would fail to retrieve a game's
        //  download path. https://github.com/Nexus-Mods/Vortex/issues/7372
        const downloadData = JSON.stringify(download, undefined, 2);
        log('error', 'Failed to open archive', downloadData);
        const attachments: IAttachment[] = [
          {
            id: 'logfile',
            type: 'file',
            data: path.join(getVortexPath('userData'), 'vortex.log'),
            description: 'Vortex Log',
          },
        ];
        const err = new Error(`Cannot find download path for ${downloadGame[0]}`);
        err['download'] = download;
        this.props.onShowError('Failed to open archive', err,
          undefined, true, attachments);
        return;
      }

      opn(path.join(downloadPathForGame(downloadGame[0]), download.localPath))
        .catch(err => {
          this.props.onShowError('Failed to open archive', err, undefined, false);
        });
    }
  }

  private inspect = (downloadId: string) => {
    const { t, onShowDialog } = this.props;
    const download = this.getDownload(downloadId);
    if (download === undefined) {
      // the download has been removed in the meantime?
      return;
    }

    if (download.state === 'failed') {
      const actions = [
            { label: 'Delete',
              action: () => this.context.api.events.emit('remove-download', downloadId) },
            { label: 'Close' },
        ];
      if ((download.failCause !== undefined) && (download.failCause.htmlFile !== undefined)) {
        onShowDialog('error', 'Download failed', {
          htmlFile: download.failCause.htmlFile,
        }, actions);
      } else if ((download.failCause !== undefined) && truthy(download.failCause.message)) {
        onShowDialog('error', 'Download failed', {
          text: download.failCause.message,
        }, actions);
      } else {
        onShowDialog('error', 'Download failed', {
          message: 'Unknown reason',
        }, actions);
      }
    } else if (download.state === 'redirect') {
      onShowDialog('error', 'Received website', {
        message: t('The url lead to this website, maybe it contains a redirection?'),
      }, [
          { label: 'Delete',
            action: () => this.context.api.events.emit('remove-download', downloadId) },
          { label: 'Close' },
      ]);
    }
  }

  private inspectable = (downloadId: string) => {
    const download = this.getDownload(downloadId);
    return ['failed', 'redirect'].includes(download.state);
  }

  private extractIds(download: IDownload) {
    if (download === undefined) {
      return undefined;
    }
    const isValid = (ids) => (ids?.fileId !== undefined
                           && ids?.gameId !== undefined
                           && ids?.modId !== undefined);
    let ids = getSafe(download.modInfo, ['nexus', 'ids'], undefined);
    if (isValid(ids)) {
      return ids;
    }
    const meta = getSafe(download.modInfo, ['meta', 'details'], undefined);
    if (meta?.fileId !== undefined) {
      ids = { fileId: meta.fileId, modId: meta.modId, gameId: download.game[0] };
      if (isValid(ids)) {
        return ids;
      }
    }
    return undefined;
  }

  private openModPage = (dlId: string) => {
    const dl = this.getDownload(dlId);
    const ids = this.extractIds(dl);
    if (ids === undefined) {
      return;
    }
    const url = path.join('www.nexusmods.com', ids.gameId,
      'mods', ids.modId.toString()) + `?tab=files&file_id=${ids.fileId}&nmm=1`;
    opn(url).catch(err => null);
    return;
  }

  private dropDownload = (type: DropType, dlPaths: string[]) => {
    if (type === 'urls') {
      dlPaths.forEach(url => this.context.api.events.emit('start-download', [url], {}, undefined,
        (err: Error) => {
          this.reportDownloadError(err, false);
        }));
    } else {
      this.context.api.events.emit('import-downloads', dlPaths);
    }
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    gameMode: selectors.activeGameId(state),
    knownGames: state.session.gameMode.known,
    downloads: state.persistent.downloads.files,
    downloadPath: selectors.downloadPath(state),
    showDropzone: state.settings.downloads.showDropzone,
    showGraph: state.settings.downloads.showGraph,
    maxBandwidth: state.settings.downloads.maxBandwidth,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetAttribute: (id, time) => dispatch(setDownloadTime(id, time)),
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
    onShowError: (message: string, details?: string | Error,
                  notificationId?: string, allowReport?: boolean) =>
      showError(dispatch, message, details, { id: notificationId, allowReport }),
    onShowDropzone: (show: boolean) => dispatch(setShowDLDropzone(show)),
    onShowGraph: (show: boolean) => dispatch(setShowDLGraph(show)),
    onFinishDownload: (dlId: string, dlState: DownloadFinishState, failReason: string) =>
      dispatch(finishDownload(dlId, dlState, { message: failReason })),
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(
    translate(['common'])(DownloadView));
