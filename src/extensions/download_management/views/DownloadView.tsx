import { showDialog } from '../../../actions/notifications';
import { selectRows } from '../../../actions/tables';
import Dropzone, { ControlMode } from '../../../controls/Dropzone';
import FlexLayout from '../../../controls/FlexLayout';
import IconBar from '../../../controls/IconBar';
import InputButton from '../../../controls/InputButton';
import SuperTable, { ITableRowAction } from '../../../controls/Table';
import DateTimeFilter from '../../../controls/table/DateTimeFilter';
import GameFilter from '../../../controls/table/GameFilter';
import ToolbarIcon from '../../../controls/ToolbarIcon';
import { IActionDefinition } from '../../../types/IActionDefinition';
import { IComponentContext } from '../../../types/IComponentContext';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../../types/IDialog';
import { ITableAttribute } from '../../../types/ITableAttribute';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { ProcessCanceled, UserCanceled } from '../../../util/CustomErrors';
import { getCurrentLanguage } from '../../../util/i18n';
import { log } from '../../../util/log';
import relativeTime from '../../../util/relativeTime';
import { activeGameId } from '../../../util/selectors';
import { setSafe } from '../../../util/storeHelper';
import MainPage from '../../../views/MainPage';

import { IGameStored } from '../../gamemode_management/types/IGameStored';
import { downloadPath as downloadPathSelector } from '../../mod_management/selectors';

import { finishDownload, initDownload,
         removeDownload, setDownloadFilePath } from '../actions/state';
import { IDownload } from '../types/IDownload';

import { FILE_NAME, FILE_SIZE, PROGRESS } from '../downloadAttributes';

import DownloadGraph from './DownloadGraph';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as I18next from 'i18next';
import * as path from 'path';
import * as PropTypes from 'prop-types';
import * as React from 'react';
import * as Redux from 'redux';
import { generate as shortid } from 'shortid';

function objectFilter(obj: any, filter: (key: string, value: any) => boolean) {
  const result = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && filter(key, obj[key])) {
      result[key] = obj[key];
    }
  }
  return result;
}

export interface IBaseProps {
  active: boolean;
  secondary: boolean;
}

interface IConnectedProps {
  downloads: { [downloadId: string]: IDownload };
  gameMode: string;
  knownGames: IGameStored[];
  downloadPath: string;
}

interface IActionProps {
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
  onDeselect: (downloadId: string) => void;
  onStartMove: (id: string, filePath: string, game: string) => void;
  onFinishMove: (id: string) => void;
  onMoveFailed: (id: string) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

interface IComponentState {
  dropActive: boolean;
}

interface IAllGamesButtonProps {
  id: string;
  buttonType: 'icon' | 'text' | 'both';
  onClick: () => void;
  t: (input: string) => string;
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
    const { t, detail, download, language, time } = this.props;

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

class DownloadView extends ComponentEx<IProps, IComponentState> {
  public context: IComponentContext;
  private staticButtons: IActionDefinition[];
  private gameColumn: ITableAttribute;
  private fileTimeColumn: ITableAttribute;
  private actions: ITableRowAction[];

  constructor(props: IProps) {
    super(props);
    this.state = {
      dropActive: false,
    };

    let lang: string;
    let collator: Intl.Collator;

    this.gameColumn = {
      id: 'gameid',
      name: 'Game',
      description: 'The game this download is associated with',
      icon: 'controller',
      calc: (attributes: IDownload) => {
        const game = this.props.knownGames.find((ele: IGameStored) => attributes.game === ele.id);
        return game ? this.props.t(game.shortName || game.name) : attributes.game;
      },
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
      name: 'File Time',
      description: 'Time the file was last modified',
      icon: 'calendar-plus-o',
      customRenderer: (attributes: IDownload, detail: boolean, t) => {
        const time = downloadTime(attributes);

        if ((time === undefined)
            && ((attributes.game !== this.props.gameMode)
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

        if ((attributes.game !== this.props.gameMode)
          || (attributes.localPath === undefined)) {
          return null;
        }
        return fs.statAsync(path.join(this.props.downloadPath, attributes.localPath))
        .then(stat => Promise.resolve(stat.mtime))
        .catch(() => undefined);
      },
      placement: 'both',
      isToggleable: true,
      edit: {},
      isSortable: true,
      filter: new DateTimeFilter(),
    };

    this.staticButtons = [
      {
        component: InputButton,
        props: () => ({
          id: 'input-download-url',
          groupId: 'download-buttons',
          key: 'input-download-url',
          icon: 'download',
          tooltip: 'Download URL',
          onConfirmed: this.startDownload,
        }),
      },
    ];

    this.actions = [
      {
        icon: 'eye',
        title: 'Inspect',
        action: this.inspect,
        condition: this.inspectable,
        multiRowAction: false,
        options: {
          noCollapse: true,
        },
      },
      {
        icon: 'file-add',
        title: 'Install',
        action: this.install,
        condition: this.installable,
        hotKey: { code: 13 },
        options: {
          noCollapse: true,
        },
      },
      {
        icon: 'button-pause',
        title: 'Pause',
        action: this.pause,
        condition: this.pausable,
      },
      {
        icon: 'play',
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
        icon: 'button-stop',
        title: 'Cancel',
        action: this.remove,
        condition: this.cancelable,
      },
    ];
  }

  public shouldComponentUpdate(nextProps: IProps) {
    return this.props.downloads !== nextProps.downloads
      || this.props.downloadPath !== nextProps.downloadPath
      || this.props.gameMode !== nextProps.gameMode
      || this.props.knownGames !== nextProps.knownGames;
  }

  public render(): JSX.Element {
    const { t, downloads, gameMode, secondary } = this.props;

    return (
      <MainPage>
        <FlexLayout type='column'>
          <FlexLayout.Fixed>
            {secondary ? null : <DownloadGraph />}
          </FlexLayout.Fixed>
          <FlexLayout.Flex>
            <SuperTable
              tableId='downloads'
              data={downloads}
              staticElements={[
                FILE_NAME,
                this.fileTimeColumn,
                this.gameColumn,
                FILE_SIZE,
                PROGRESS,
              ]}
              actions={this.actions}
            />
          </FlexLayout.Flex>
          <FlexLayout.Fixed>
            {
              ((gameMode !== undefined) && !secondary)
                ? (
                  <Dropzone
                    accept={['urls', 'files']}
                    drop={this.dropDownload}
                    dialogHint={t('Enter download URL')}
                  />
                ) : null
            }
          </FlexLayout.Fixed>
        </FlexLayout>
        <MainPage.Overlay>
          <IconBar
            group='download-icons'
            staticElements={this.staticButtons}
            style={{ width: '100%', display: 'flex' }}
            buttonType='both'
            orientation='vertical'
          />
        </MainPage.Overlay>
      </MainPage>
    );
  }

  private getDownload(downloadId: string): IDownload {
    return this.props.downloads[downloadId];
  }

  private startDownload = (url: string) => {
    this.context.api.events.emit('start-download', [url], {}, (err) => {
      if (err !== undefined) {
        if (err instanceof UserCanceled) {
          // nop
        } else if (err instanceof ProcessCanceled) {
          this.context.api.sendNotification({
            type: 'warning',
            message: err.message,
          });
        } else {
          this.context.api.showErrorNotification('Failed to start download', err);
        }
      }
    });
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
      this.context.api.events.emit('resume-download', downloadId);
    });
  }

  private resumable = (downloadIds: string[]) => {
    return downloadIds.find((downloadId: string) => (
      this.getDownload(downloadId).state === 'paused'
    )) !== undefined;
  }

  private remove = (downloadIds: string[]) => {
    const removeId = (id: string) => {
      this.props.onDeselect(id);
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
    const match = ['finished', 'failed'];
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
      if (download.failCause.htmlFile !== undefined) {
        onShowDialog('error', 'Download failed', {
          htmlFile: download.failCause.htmlFile,
        }, [
            { label: 'Delete',
              action: () => this.context.api.events.emit('remove-download', downloadId) },
            { label: 'Close' },
        ]);
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

  private move(source: string, destination: string) {
    const { gameMode, onStartMove, onFinishMove, onMoveFailed } = this.props;
    const id = shortid();
    onStartMove(id, destination, gameMode);
    fs.renameAsync(source, destination)
      .catch(err => {
        if (err.code === 'EXDEV') {
          // can't rename cross devices, copy&unlink it is
          return fs.copyAsync(source, destination)
            .then(() => fs.unlinkAsync(source));
        } else {
          throw err;
        }
      })
      .then(() => onFinishMove(id))
      .catch(err => {
        log('info', 'failed to move', { err });
        onMoveFailed(id);
      });
  }

  private dropDownload = (type: ControlMode, dlPaths: string[]) => {
    if (type === 'urls') {
      dlPaths.forEach(url => this.context.api.events.emit('start-download', [url], {}));
    } else {
      const { downloadPath, gameMode } = this.props;
      dlPaths.forEach(dlPath => {
        const destination = path.join(downloadPath, path.basename(dlPath));
        this.move(dlPath, destination);
      });
    }
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    gameMode: activeGameId(state),
    knownGames: state.session.gameMode.known,
    downloads: state.persistent.downloads.files,
    downloadPath: downloadPathSelector(state),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
    onDeselect: (downloadId: string) =>
      dispatch(selectRows('downloads', [downloadId], false)),
    onStartMove: (id: string, filePath: string, game: string) => {
      dispatch(initDownload(id, [], {}, game));
      dispatch(setDownloadFilePath(id, path.basename(filePath)));
    },
    onFinishMove: (id: string) => dispatch(finishDownload(id, 'finished')),
    onMoveFailed: (id: string) => dispatch(removeDownload(id)),
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(
    translate(['common'], { wait: false })(DownloadView));
