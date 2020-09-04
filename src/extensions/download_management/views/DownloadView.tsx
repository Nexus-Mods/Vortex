import { showDialog } from '../../../actions/notifications';
import Banner from '../../../controls/Banner';
import CollapseIcon from '../../../controls/CollapseIcon';
import Dropzone, { DropType } from '../../../controls/Dropzone';
import EmptyPlaceholder from '../../../controls/EmptyPlaceholder';
import FlexLayout from '../../../controls/FlexLayout';
import SuperTable, { ITableRowAction } from '../../../controls/Table';
import { IComponentContext } from '../../../types/IComponentContext';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../../types/IDialog';
import { IState } from '../../../types/IState';
import { ITableAttribute } from '../../../types/ITableAttribute';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { ProcessCanceled, TemporaryError, UserCanceled } from '../../../util/CustomErrors';
import { showError } from '../../../util/message';
import opn from '../../../util/opn';
import * as selectors from '../../../util/selectors';
import { truthy } from '../../../util/util';
import MainPage from '../../../views/MainPage';

import { IGameStored } from '../../gamemode_management/types/IGameStored';

import { setShowDLDropzone, setShowDLGraph } from '../actions/settings';
import { setDownloadTime } from '../actions/state';
import { IDownload } from '../types/IDownload';

import createColumns from '../downloadAttributes';
import { DownloadIsHTML } from '../DownloadManager';

import DownloadGraph from './DownloadGraph';

import Promise from 'bluebird';
import { TFunction } from 'i18next';
import * as path from 'path';
import * as React from 'react';
import { Button, Panel } from 'react-bootstrap';
import { WithTranslation } from 'react-i18next';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

export interface IDownloadViewBaseProps extends WithTranslation {
  active: boolean;
  secondary: boolean;
}

interface IConnectedProps {
  downloads: { [downloadId: string]: IDownload };
  gameMode: string;
  knownGames: IGameStored[];
  downloadPath: string;
  downloadPathForGame: (gameId: string) => string;
  showDropzone: boolean;
  showGraph: boolean;
}

interface IActionProps {
  onSetAttribute: (id: string, time: number) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
  onShowError: (message: string, details?: string | Error,
                notificationId?: string, allowReport?: boolean) => void;
  onShowDropzone: (show: boolean) => void;
  onShowGraph: (show: boolean) => void;
}

export type IDownloadViewProps =
  IDownloadViewBaseProps & IConnectedProps & IActionProps & { t: TFunction };

interface IComponentState {
  viewAll: boolean;
}

const nop = () => null;

class DownloadView extends ComponentEx<IDownloadViewProps, IComponentState> {
  public context: IComponentContext;
  private actions: ITableRowAction[];
  private mColumns: Array<ITableAttribute<IDownload>>;

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
        action: this.remove,
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
  }

  public shouldComponentUpdate(nextProps: IDownloadViewProps, nextState: IComponentState) {
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
    const { t, downloads, gameMode, secondary, showGraph } = this.props;
    const { viewAll } = this.state;

    if (this.mColumns === undefined) {
      this.mColumns = createColumns(this.context.api, () => this.props);
    }

    let content = null;

    if (Object.keys(this.props.downloads).length === 0) {
      content = this.renderDropzone();
    } else {
      const filtered = viewAll
        ? downloads
        : Object.keys(downloads)
            .filter(dlId => downloads[dlId].installed === undefined)
            .reduce((prev, dlId) => {
              prev[dlId] = downloads[dlId];
              return prev;
            }, {});
      content = (
        <FlexLayout type='column'>
          {secondary ? null : <Banner group='downloads' />}
          <FlexLayout.Flex>
            <Panel className='download-panel' >
              {secondary ? null : (
                <Panel
                  className='download-graph-panel'
                  expanded={showGraph}
                  onToggle={nop}
                >
                  <Panel.Body collapsible={true}>
                    <DownloadGraph />
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
                      data={filtered}
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
          <FlexLayout.Fixed>
            {secondary ? null : this.renderDropzone()}
          </FlexLayout.Fixed>
        </FlexLayout>
      );
    }

    return (
      <MainPage>
        <MainPage.Body>
          {content}
        </MainPage.Body>
      </MainPage>
    );
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
              accept={['urls', 'files']}
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
    return downloadIds.find((downloadId: string) => (
      this.getDownload(downloadId).state === 'started'
    )) !== undefined;
  }

  private resume = (downloadIds: string[]) => {
    downloadIds.forEach((downloadId: string) => {
      this.context.api.events.emit('resume-download', downloadId, (err) => {
        if (err !== null) {
          const urlInvalid = ['moved permanently', 'forbidden', 'gone'];
          if (err instanceof ProcessCanceled) {
            this.props.onShowError('Failed to resume download',
                                   'Sorry, this download is missing info necessary to resume. '
                                   + 'Please try restarting it.',
                                   undefined, false);
          } else if (err instanceof UserCanceled) {
            // nop
          } else if (err instanceof DownloadIsHTML) {
            this.props.onShowError('Failed to resume download',
                                   'Sorry, the download link is no longer valid. '
                                   + 'Please restart the download.',
              undefined, false);
          } else if ((err.HTTPStatus !== undefined)
                     && (urlInvalid.indexOf(err.HTTPStatus.toLowerCase()) !== -1)) {
            this.props.onShowError('Failed to resume download',
                                   'Sorry, the download link is no longer valid. '
                                   + 'Please restart the download.',
              undefined, false);
          } else if (err instanceof TemporaryError) {
            this.props.onShowError('Failed to resume download',
                                   'Downloading failed due to an I/O error (either '
                                   + 'network or disk access). This is very likely a '
                                   + 'temporary problem, please try resuming at a later time.',
                                   undefined, false);
          } else if (err.code === 'ECONNRESET') {
            this.props.onShowError('Failed to resume download',
                                   'Server closed the connection, please '
                                   + 'check your internet connection',
              undefined, false);
          } else if (err.code === 'ETIMEDOUT') {
            this.props.onShowError('Failed to resume download',
                                   'Connection timed out, please check '
                                   + 'your internet connection',
              undefined, false);
          } else if (err.code === 'ENOSPC') {
            this.props.onShowError('Failed to resume download', 'The disk is full',
              undefined, false);
          } else if (err.code === 'EBADF') {
            this.props.onShowError('Failed to resume download',
                                   'Failed to write to disk. If you use a removable media or '
                                   + 'a network drive, the connection may be unstable. '
                                   + 'Please try resuming once you checked.',
              undefined, false);
          } else if (err.message.indexOf('DECRYPTION_FAILED_OR_BAD_RECORD_MAC') !== -1) {
            this.props.onShowError('Failed to resume download',
                                   'Network communication error (SSL payload corrupted). '
                                   + 'This is likely a temporary issue, please try again later.',
                                   undefined, false);
          } else {
            this.props.onShowError('Failed to resume download', err);
          }
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

    onShowDialog('question', 'Confirm Removal', {
      text: t('Do you really want to delete this archive?',
        { count: downloadIds.length, replace: { count: downloadIds.length } }),
      message: downloadNames.join('\n'),
    }, [
        { label: 'Cancel' },
        { label: 'Remove', action: () => downloadIds.forEach(removeId) },
    ]);
  }

  private removable = (downloadIds: string[]) => {
    const match = ['finished', 'failed', undefined];
    return downloadIds.find((downloadId: string) => (
      match.indexOf(this.getDownload(downloadId).state) >= 0
    )) !== undefined;
  }

  private cancelable = (downloadIds: string[]) => {
    const match = ['init', 'started', 'paused', 'redirect'];
    return downloadIds.find((downloadId: string) => (
      match.indexOf(this.getDownload(downloadId).state) >= 0
    )) !== undefined;
  }

  private install = (downloadIds: string[]) => {
    downloadIds.forEach((downloadId: string) => {
      this.context.api.events.emit('start-install-download', downloadId);
    });
  }

  private installAsIs = (downloadIds: string[]) => {
    downloadIds.forEach((downloadId: string) => {
      this.context.api.events.emit('start-install-download', downloadId, undefined, undefined, 'fallback');
    });
  }

  private installable = (downloadIds: string[]) => {
    return downloadIds.find(
      (id: string) => this.getDownload(id).state === 'finished') !== undefined;
  }

  private open = (downloadId: string) => {
    const { downloadPathForGame, downloads } = this.props;
    const download: IDownload = downloads[downloadId];
    if ((download !== undefined) && (download.localPath !== undefined)) {
      const downloadGame = Array.isArray(download.game)
        ? download.game[0]
        : download.game;
      opn(path.join(downloadPathForGame(downloadGame), download.localPath))
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
    return [ 'failed', 'redirect' ].indexOf(download.state) >= 0;
  }

  private dropDownload = (type: DropType, dlPaths: string[]) => {
    if (type === 'urls') {
      dlPaths.forEach(url => this.context.api.events.emit('start-download', [url], {}, undefined,
        (error: Error) => {
        if ((error !== null)
            && !(error instanceof DownloadIsHTML)
            && !(error instanceof UserCanceled)) {
          if (error instanceof ProcessCanceled) {
            this.context.api.showErrorNotification('Failed to start download',
              error.message, {
              allowReport: false,
            });
          } else if (error.message.match(/Protocol .* not supported/) !== null) {
            this.context.api.showErrorNotification('Failed to start download',
              error.message, {
              allowReport: false,
            });
          } else {
            this.context.api.showErrorNotification('Failed to start download', error, {
              allowReport: false,
            });
          }
        }
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
    downloadPathForGame: (game: string) => selectors.downloadPathForGame(state, game),
    showDropzone: state.settings.downloads.showDropzone,
    showGraph: state.settings.downloads.showGraph,
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
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(
    translate(['common'])(DownloadView));
