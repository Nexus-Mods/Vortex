import { showDialog } from '../../../actions/notifications';
import { selectRows } from '../../../actions/tables';
import { IActionDefinition } from '../../../types/IActionDefinition';
import { IComponentContext } from '../../../types/IComponentContext';
import { IDialogResult } from '../../../types/IDialog';
import { ITableAttribute } from '../../../types/ITableAttribute';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { getCurrentLanguage } from '../../../util/i18n';
import relativeTime from '../../../util/relativeTime';
import { activeGameId } from '../../../util/selectors';
import { setSafe } from '../../../util/storeHelper';
import IconBar from '../../../views/IconBar';
import InputButton from '../../../views/InputButton';
import MainPage from '../../../views/MainPage';
import SuperTable, {ITableRowAction} from '../../../views/Table';
import ToolbarIcon from '../../../views/ToolbarIcon';

import DateTimeFilter from '../../../views/table/DateTimeFilter';
import GameFilter from '../../../views/table/GameFilter';

import { IGameStored } from '../../gamemode_management/types/IGameStored';
import { downloadPath } from '../../mod_management/selectors';

import { IDownload } from '../types/IDownload';

import {FILE_NAME, PROGRESS} from '../downloadAttributes';

import DownloadDropzone from './DownloadDropzone';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as PropTypes from 'prop-types';
import * as React from 'react';
import { Fixed, Flex, Layout } from 'react-layout-pane';

function objectFilter(obj: any, filter: (key: string, value: any) => boolean) {
  const result = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && filter(key, obj[key])) {
      result[key] = obj[key];
    }
  }
  return result;
}

interface IConnectedProps {
  downloads: { [downloadId: string]: IDownload };
  gameMode: string;
  knownGames: IGameStored[];
  downloadPath: string;
}

interface IActionProps {
  onShowDialog: (type, title, content, actions) => Promise<IDialogResult>;
  onDeselect: (downloadId: string) => void;
}

type IProps = IConnectedProps & IActionProps;

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
}

class FileTime extends ComponentEx<IFileTimeProps, { mtime: Date }> {
  constructor(props: IFileTimeProps) {
    super(props);

    this.initState({ mtime: undefined });
  }

  public componentWillMount() {
    this.updateTime();
  }

  public componentWillReceiveProps(nextProps: IFileTimeProps) {
    if ((this.props.downloadPath !== nextProps.downloadPath)
      || (this.props.download !== nextProps.download)) {
        this.updateTime();
      }
  }

  public render(): JSX.Element {
    const { t, detail, download, language } = this.props;
    const { mtime } = this.state;
    if ((download.localPath === undefined) || (mtime === undefined)) {
      return null;
    }

    if (detail) {
      return <p>{mtime.toLocaleString(language)}</p>;
    } else {
      return <p>{relativeTime(mtime, t)}</p>;
    }
  }

  private updateTime() {
    const { download, downloadPath } = this.props;
    if (download.localPath === undefined) {
        return null;
    } else {
      return fs.statAsync(path.join(downloadPath, download.localPath))
        .then((stat: fs.Stats) => this.nextState.mtime = stat.mtime);
    }
  }
}

class DownloadView extends ComponentEx<IProps, IComponentState> {
  public static contextTypes: React.ValidationMap<any> = {
    api: PropTypes.object.isRequired,
  };

  public context: IComponentContext;
  private staticButtons: IActionDefinition[];
  private gameColumn: ITableAttribute;
  private fileTimeColumn: ITableAttribute;
  private actions: ITableRowAction[];

  constructor(props) {
    super(props);
    this.state = {
      dropActive: false,
    };

    this.gameColumn = {
      id: 'gameid',
      name: 'Game',
      description: 'The game this download is associated with',
      icon: 'gamepad',
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
        return lhs.localeCompare(rhs, locale, { sensitivity: 'base' });
      },
    };

    this.fileTimeColumn = {
      id: 'filetime',
      name: 'File Time',
      description: 'Time the file was last modified',
      icon: 'calendar-plus-o',
      customRenderer: (attributes: IDownload, detail: boolean, t) => {
        if (attributes.game !== this.props.gameMode) {
          return null;
        }
        return (
          <FileTime
            t={t}
            download={attributes}
            downloadPath={this.props.downloadPath}
            detail={detail}
            language={getCurrentLanguage()}
          />
        );
      },
      calc: (attributes: IDownload) => {
        if (attributes.localPath === undefined) {
          return undefined;
        }
        if (attributes.game !== this.props.gameMode) {
          return undefined;
        }
        return fs.statAsync(path.join(this.props.downloadPath, attributes.localPath))
        .then(
          stat => Promise.resolve(stat.mtime));
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
      },
      {
        icon: 'archive',
        title: 'Install',
        action: this.install,
        condition: this.installable,
      },
      {
        icon: 'pause',
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
      },
      {
        icon: 'stop',
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
    const { downloads, gameMode } = this.props;

    return (
      <MainPage>
        <Layout type='column'>
          <Flex style={{ height: '100%', overflowY: 'auto' }} >
            <SuperTable
              tableId='downloads'
              data={downloads}
              staticElements={[FILE_NAME, this.fileTimeColumn, this.gameColumn, PROGRESS]}
              actions={this.actions}
            />
          </Flex>
          <Fixed>
            <DownloadDropzone />
          </Fixed>
        </Layout>
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
    this.context.api.events.emit('start-download', [url], {});
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
      }, {
          Cancel: null,
          Remove: () => downloadIds.forEach(removeId),
        });
    }
  }

  private removable = (downloadIds: string[]) => {
    const match = ['finished', 'failed'];
    return downloadIds.find((downloadId: string) => (
      match.indexOf(this.getDownload(downloadId).state) >= 0
    )) !== undefined;
  }

  private cancelable = (downloadIds: string[]) => {
    const match = ['init', 'started', 'paused'];
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
    const { onShowDialog } = this.props;
    const download = this.getDownload(downloadId);
    if (download.state === 'failed') {
      if (download.failCause.htmlFile !== undefined) {
        onShowDialog('error', 'Download failed', {
          htmlFile: download.failCause.htmlFile,
        }, {
            Delete: () => this.context.api.events.emit('remove-download', downloadId),
            Close: null,
          });
      }
    }
  }

  private inspectable = (downloadId: string) => {
    const download = this.getDownload(downloadId);
    return [ 'failed' ].indexOf(download.state) >= 0;
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    gameMode: activeGameId(state),
    knownGames: state.session.gameMode.known,
    downloads: state.persistent.downloads.files,
    downloadPath: downloadPath(state),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
    onDeselect: (downloadId: string) =>
      dispatch(selectRows('downloads', [downloadId], false)),
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(
    translate(['common'], { wait: false })(DownloadView));
