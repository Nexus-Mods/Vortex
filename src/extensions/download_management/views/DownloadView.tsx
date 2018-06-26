import { showDialog } from '../../../actions/notifications';
import Banner from '../../../controls/Banner';
import CollapseIcon from '../../../controls/CollapseIcon';
import Dropzone, { DropType } from '../../../controls/Dropzone';
import EmptyPlaceholder from '../../../controls/EmptyPlaceholder';
import FlexLayout from '../../../controls/FlexLayout';
import SuperTable, { ITableRowAction } from '../../../controls/Table';
import DateTimeFilter from '../../../controls/table/DateTimeFilter';
import GameFilter from '../../../controls/table/GameFilter';
import { IComponentContext } from '../../../types/IComponentContext';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../../types/IDialog';
import { IState } from '../../../types/IState';
import { ITableAttribute } from '../../../types/ITableAttribute';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { ProcessCanceled } from '../../../util/CustomErrors';
import * as fs from '../../../util/fs';
import { getCurrentLanguage } from '../../../util/i18n';
import { showError } from '../../../util/message';
import relativeTime from '../../../util/relativeTime';
import * as selectors from '../../../util/selectors';
import MainPage from '../../../views/MainPage';

import { IGameStored } from '../../gamemode_management/types/IGameStored';

import { setShowDLDropzone, setShowDLGraph } from '../actions/settings';
import { setDownloadTime } from '../actions/state';
import { IDownload } from '../types/IDownload';
import getDownloadGames from '../util/getDownloadGames';

import { FILE_NAME, FILE_SIZE, LOGICAL_NAME, PROGRESS } from '../downloadAttributes';
import { DownloadIsHTML } from '../DownloadManager';

import DownloadGameList from './DownloadGameList';
import DownloadGraph from './DownloadGraph';

import * as Promise from 'bluebird';
import * as I18next from 'i18next';
import * as path from 'path';
import * as React from 'react';
import { Button, Panel } from 'react-bootstrap';
import * as Redux from 'redux';

const PanelX: any = Panel;

export interface IBaseProps {
  active: boolean;
  secondary: boolean;
}

interface IConnectedProps {
  downloads: { [downloadId: string]: IDownload };
  gameMode: string;
  knownGames: IGameStored[];
  downloadPath: string;
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

type IProps = IBaseProps & IConnectedProps & IActionProps;

interface IComponentState {
  viewAll: boolean;
}

interface IFileTimeProps {
  t: I18next.TranslationFunction;
  language: string;
  detail: boolean;
  download: IDownload;
  downloadPath: string;
  time: Date;
}

class FileTime extends ComponentEx<IFileTimeProps, { mtime: Date }> {
  private mIsMounted: boolean = false;

  constructor(props: IFileTimeProps) {
    super(props);

    this.initState({ mtime: undefined });
  }

  public componentDidMount() {
    this.mIsMounted = true;
    this.updateTime();
  }

  public componentWillUnmount() {
    this.mIsMounted = false;
  }

  public componentWillReceiveProps(nextProps: IFileTimeProps) {
    if ((nextProps.time === undefined)
      && ((this.props.downloadPath !== nextProps.downloadPath)
        || (this.props.download !== nextProps.download))) {
        this.updateTime();
      }
  }

  public render(): JSX.Element {
    const { t, detail, language, time } = this.props;

    const mtime = time || this.state.mtime;

    if (mtime === undefined) {
      return null;
    }

    if (detail) {
      return <span>{mtime.toLocaleString(language)}</span>;
    } else {
      return <span>{relativeTime(mtime, t)}</span>;
    }
  }

  private updateTime() {
    const { download, downloadPath } = this.props;
    if ((download.localPath === undefined) || (downloadPath === undefined)) {
        return null;
    } else {
      return fs.statAsync(path.join(downloadPath, download.localPath))
        .then((stat: fs.Stats) => {
          if (this.mIsMounted) {
            this.nextState.mtime = stat.mtime;
          }
        })
        .catch(err => undefined);
    }
  }
}

function downloadTime(download: IDownload) {
  return (download.fileTime !== undefined)
    ? new Date(download.fileTime)
    : undefined;
}

const nop = () => null;

class DownloadView extends ComponentEx<IProps, IComponentState> {
  public context: IComponentContext;
  private gameColumn: ITableAttribute<IDownload>;
  private fileTimeColumn: ITableAttribute<IDownload>;
  private actions: ITableRowAction[];

  constructor(props: IProps) {
    super(props);
    this.initState({
      viewAll: false,
    });

    let lang: string;
    let collator: Intl.Collator;

    this.gameColumn = {
      id: 'game',
      name: 'Game',
      description: 'The game(s) this download is associated with',
      help: 'You can associate a download with multiple compatible games so it will show up '
          + 'when managing those games as well.',
      icon: 'game',
      customRenderer: (download: IDownload, detailCell: boolean,
                       t: I18next.TranslationFunction) => {
        const { downloads } = this.props;
        const { store } = this.context.api;
        // TODO: awkward!
        const id = Object.keys(downloads).find(dlId => downloads[dlId] === download);
        if (detailCell) {
          return (
            <DownloadGameList
              t={t}
              id={id}
              currentGames={getDownloadGames(download)}
              games={this.props.knownGames}
            />);
        } else {
          const games = getDownloadGames(download);
          const name = selectors.gameName(store.getState(), games[0]);
          const more = games.length > 1 ? '...' : '';
          return (
            <div>
              {name}{more}
            </div>
          );
        }
      },
      calc: (attributes: IDownload) => getDownloadGames(attributes),
      placement: 'both',
      isToggleable: true,
      edit: {},
      isSortable: true,
      filter: new GameFilter(),
      sortFunc: (lhs: string, rhs: string, locale: string): number => {
        if ((collator === undefined) || (locale !== lang)) {
          lang = locale;
          collator = new Intl.Collator(locale, { sensitivity: 'base' });
        }
        return collator.compare(lhs, rhs);
      },
    };

    this.fileTimeColumn = {
      id: 'filetime',
      name: 'Downloaded',
      description: 'Time the file was last modified',
      icon: 'calendar-plus-o',
      customRenderer: (attributes: IDownload, detail: boolean, t) => {
        const time = downloadTime(attributes);

        if ((time === undefined)
            && ((getDownloadGames(attributes)[0] !== this.props.gameMode)
                || (attributes.localPath === undefined))) {
          return null;
        }
        return (
          <FileTime
            t={t}
            time={time}
            download={attributes}
            downloadPath={this.props.downloadPath}
            detail={detail}
            language={getCurrentLanguage()}
          />
        );
      },
      calc: (attributes: IDownload) => {
        const time = downloadTime(attributes);

        if (time !== undefined) {
          return time;
        }

        if ((getDownloadGames(attributes)[0] !== this.props.gameMode)
          || (attributes.localPath === undefined)) {
          return null;
        }
        return fs.statAsync(path.join(this.props.downloadPath, attributes.localPath))
        .then(stat => {
          const { downloads, onSetAttribute } = this.props;
          const id = Object.keys(downloads).find(key => downloads[key] === attributes);
          onSetAttribute(id, stat.mtimeMs);
          return Promise.resolve(stat.mtime);
        })
        .catch(() => undefined);
      },
      placement: 'both',
      isToggleable: true,
      edit: {},
      isSortable: true,
      filter: new DateTimeFilter(),
    };

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
        icon: 'remove',
        title: 'Remove',
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
    ];
  }

  public componentWillMount() {
    this.nextState.viewAll = false;
  }

  public shouldComponentUpdate(nextProps: IProps, nextState: IComponentState) {
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

    let content = null;

    if (gameMode === undefined) {
      content = (
        <Panel className='placeholder-container'>
          <PanelX.Body>
            <EmptyPlaceholder
              icon='folder-download'
              text={t('Please select a game to manage first')}
            />
          </PanelX.Body>
        </Panel>
      );
    } else if (Object.keys(this.props.downloads).length === 0) {
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
            <PanelX className='download-panel' >
              {secondary ? null : (
                <PanelX
                  className='download-graph-panel'
                  expanded={showGraph}
                  onToggle={nop}
                >
                  <PanelX.Body collapsible={true}>
                    <DownloadGraph />
                  </PanelX.Body>
                  <CollapseIcon
                    position='bottomright'
                    onClick={this.toggleGraph}
                    visible={showGraph}
                  />
                </PanelX>
              )}
            <PanelX.Body>
                <FlexLayout type='column'>
                  <FlexLayout.Flex>
                    <SuperTable
                      tableId='downloads'
                      data={filtered}
                      staticElements={[
                        FILE_NAME,
                        LOGICAL_NAME,
                        this.fileTimeColumn,
                        this.gameColumn,
                        FILE_SIZE,
                        PROGRESS,
                      ]}
                      actions={this.actions}
                    />
                      </FlexLayout.Flex>
                  <FlexLayout.Fixed style={{ textAlign: 'center' }}>
                    <Button bsStyle='ghost' onClick={this.toggleViewAll} >
                      {viewAll ? t('View not-yet-installed Downloads') : t('View All Downloads')}
                    </Button>
                  </FlexLayout.Fixed>
                </FlexLayout>
              </PanelX.Body>
            </PanelX>
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
      <PanelX
        className='download-drop-panel'
        expanded={showDropzone}
        onToggle={nop}
      >
        <PanelX.Collapse>
          <PanelX.Body>
            <Dropzone
              accept={['urls', 'files']}
              drop={this.dropDownload}
              dialogHint={t('Enter download URL')}
              icon='folder-download'
            />
          </PanelX.Body>
        </PanelX.Collapse>
        <CollapseIcon
          position='topright'
          onClick={this.toggleDropzone}
          visible={showDropzone}
        />
      </PanelX>
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
          if (err instanceof ProcessCanceled) {
            this.props.onShowError('Failed to download',
                                   'Sorry, this download is missing info necessary to resume. '
                                   + 'Please try restarting it.',
                                   undefined, false);
          } else if ((err.message === 'Moved Permanently') || (err.message === 'Forbidden')) {
            this.props.onShowError('Failed to download', 'The url is no longer valid',
              undefined, false);
          } else if (err.code === 'ECONNRESET') {
            this.props.onShowError('Failed to download', 'Server closed the connection, please '
                                  + 'check your internet connection',
              undefined, false);
          } else if (err.code === 'ETIMEDOUT') {
            this.props.onShowError('Failed to download', 'Connection timed out, please check '
                                  + 'your internet connection',
              undefined, false);
          } else if (err.code === 'ENOSPC') {
            this.props.onShowError('Failed to download', 'The disk is full',
              undefined, false);
          } else {
            this.props.onShowError('Failed to download', err);
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

  private remove = (downloadIds: string[]) => {
    const removeId = (id: string) => {
      this.context.api.events.emit('remove-download', id);
    };

    if (downloadIds.length === 1) {
      removeId(downloadIds[0]);
    } else {
      const { t, onShowDialog } = this.props;

      const downloadNames = downloadIds.map((downloadId: string) => (
        this.getDownload(downloadId).localPath
      ));

      onShowDialog('question', 'Confirm Removal', {
        message: t('Do you really want to delete this archive?',
          { count: downloadIds.length, replace: { count: downloadIds.length } })
        + '\n' + downloadNames.join('\n'),
      }, [
          { label: 'Cancel' },
          { label: 'Remove', action: () => downloadIds.forEach(removeId) },
      ]);
    }
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

  private installable = (downloadIds: string[]) => {
    return downloadIds.find(
      (id: string) => this.getDownload(id).state === 'finished') !== undefined;
  }

  private inspect = (downloadId: string) => {
    const { t, onShowDialog } = this.props;
    const download = this.getDownload(downloadId);
    if (download.state === 'failed') {
      const actions = [
            { label: 'Delete',
              action: () => this.context.api.events.emit('remove-download', downloadId) },
            { label: 'Close' },
        ];
      if (download.failCause.htmlFile !== undefined) {
        onShowDialog('error', 'Download failed', {
          htmlFile: download.failCause.htmlFile,
        }, actions);
      } else if (download.failCause.message) {
        onShowDialog('error', 'Download failed', {
          message: download.failCause.message,
        }, actions);
      } else {
        onShowDialog('error', 'Download failed', {
          message: 'Unknown reason',
        }, actions);
      }
    } else if (download.state === 'redirect') {
      onShowDialog('error', 'Received website', {
        message: t('The url lead to this website, maybe it contains a redirection?'),
        htmlFile: download.failCause.htmlFile,
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
        if ((error !== null) && !(error instanceof DownloadIsHTML)) {
          this.context.api.showErrorNotification('Failed to start download', error, {
            allowReport: !(error instanceof ProcessCanceled),
          });
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
    showDropzone: state.settings.downloads.showDropzone,
    showGraph: state.settings.downloads.showGraph,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
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
    translate(['common'], { wait: false })(DownloadView));
