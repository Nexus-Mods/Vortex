import { showDialog } from '../../../actions/notifications';
import { selectRows } from '../../../actions/tables';
import { IComponentContext } from '../../../types/IComponentContext';
import { IDialogResult } from '../../../types/IDialog';
import { IIconDefinition } from '../../../types/IIconDefinition';
import { ITableAttribute } from '../../../types/ITableAttribute';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import {setSafe} from '../../../util/storeHelper';
import Icon from '../../../views/Icon';
import IconBar from '../../../views/IconBar';
import InputButton from '../../../views/InputButton';
import SuperTable, {makeGetSelection} from '../../../views/Table';
import {Button} from '../../../views/TooltipControls';

import { IGameStored } from '../../gamemode_management/types/IStateEx';
import { downloadPath } from '../../mod_management/selectors';

import { IDownload } from '../types/IDownload';

import {FILE_NAME, PROGRESS} from '../downloadAttributes';

import DownloadDropzone from './DownloadDropzone';

import * as Promise from 'bluebird';
import * as path from 'path';
import * as React from 'react';
import { Fixed, Flex, Layout } from 'react-layout-pane';

import {log} from '../../../util/log';
import * as util from 'util';

interface IConnectedProps {
  downloads: IDownload[];
  gameMode: string;
  knownGames: IGameStored[];
  downloadPath: string;
  selection: string[];
}

interface IActionProps {
  onShowDialog: (type, title, content, actions) => Promise<IDialogResult>;
  onDeselect: (downloadId: string) => void;
}

type IProps = IConnectedProps & IActionProps;

interface IComponentState {
  dropActive: boolean;
  showAll: boolean;
}

interface IAllGamesButtonProps {
  id: string;
  showAll: boolean;
  onClick: Function;
  t: (input: string) => string;
}

const AllGamesButton = (props) => {
  const { t, id, onClick, showAll } = props;
  let tooltip =
    showAll
    ? t('Hide downloads from other games')
    : t('Show downloads from other games');
  return (
    <Button
      id={id}
      tooltip={tooltip}
      onClick={onClick}
    >
      <Icon name={showAll ? 'eye' : 'eye-slash'}/>
    </Button>
  );
};

class DownloadView extends ComponentEx<IProps, IComponentState> {
  public static contextTypes: React.ValidationMap<any> = {
    api: React.PropTypes.object.isRequired,
  };

  public context: IComponentContext;
  private staticButtons: IIconDefinition[];

  private gameColumn: ITableAttribute;
  private rowActions: IIconDefinition[];
  private multiActions: IIconDefinition[];

  constructor(props) {
    super(props);
    this.state = {
      dropActive: false,
      showAll: false,
    };

    this.gameColumn = {
      id: 'gameid',
      name: 'Game',
      description: 'The game this download is associated with',
      icon: 'gamepad',
      calc: (attributes: IDownload) => {
        let game = this.props.knownGames.find((ele: IGameStored) => attributes.game === ele.id);
        return game ? this.props.t(game.name) : attributes.game;
      },
      isDetail: false,
      isToggleable: true,
      isReadOnly: true,
      isSortable: true,
    };

    this.staticButtons = [
      {
        component: AllGamesButton as any,
        props: () => ({
          id: 'btn-show-all-games',
          key: 'btn-show-all-games',
          showAll: this.state.showAll,
          t: props.t,
          onClick: () => this.setState(setSafe(this.state, ['showAll'], !this.state.showAll)),
        }),
      },
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

    this.rowActions = [
      {
        icon: 'eye',
        title: 'Inspect',
        action: this.inspect,
        condition: this.inspectable,
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

    this.multiActions = [
      {
        icon: 'archive',
        title: 'Install',
        action: this.installMulti,
        condition: this.installableMulti,
      },
      {
        icon: 'pause',
        title: 'Pause',
        action: this.pauseMulti,
        condition: this.pausableMulti,
      },
      {
        icon: 'play',
        title: 'Resume',
        action: this.resumeMulti,
        condition: this.resumableMulti,
      },
      {
        icon: 'remove',
        title: 'Remove',
        action: this.removeMulti,
        condition: this.removableMulti,
      },
      {
        icon: 'stop',
        title: 'Cancel',
        action: this.removeMulti,
        condition: this.cancelableMulti,
      },
    ];
  }

  public render(): JSX.Element {
    const { downloads } = this.props;

    return (
      <Layout type='column'>
        <Fixed>
          <IconBar
            group='download-icons'
            staticElements={this.staticButtons}
            style={{ width: '100%', display: 'flex' }}
          />
        </Fixed>
        <Flex style={{ height: '100%', overflowY: 'auto' }} >
          <SuperTable
            tableId='downloads'
            data={downloads}
            staticElements={[ FILE_NAME, this.gameColumn, PROGRESS ]}
            rowActions={this.rowActions}
            multiActions={this.multiActions}
            onChangeData={() => undefined}
          />
        </Flex>
        <Fixed>
          <DownloadDropzone />
        </Fixed>
      </Layout>
    );
  }

  private getDownload(downloadId: string): IDownload {
    return this.props.downloads[downloadId];
  }

  private startDownload = (url: string) => {
    this.context.api.events.emit('start-download', [url], {});
  }

  private pause = (downloadId: string) => {
    this.context.api.events.emit('pause-download', downloadId);
  }

  private pausable = (downloadId: string) => {
    return this.getDownload(downloadId).state === 'started';
  }

  private resume = (downloadId: string) => {
    this.context.api.events.emit('resume-download', downloadId);
  }

  private resumable = (downloadId: string) => {
    return this.getDownload(downloadId).state === 'paused';
  }

  private remove = (downloadId: string) => {
    this.props.onDeselect(downloadId);
    this.context.api.events.emit('remove-download', downloadId);
  }

  private removable = (downloadId: string) => {
    const download = this.getDownload(downloadId);
    return ['finished', 'failed'].indexOf(download.state) >= 0;
  }

  private cancelable = (downloadId: string) => {
    const download = this.getDownload(downloadId);
    return ['init', 'started', 'paused'].indexOf(download.state) >= 0;
  }

  private install = (downloadId: string) => {
    this.context.api.events.emit('start-install-download', downloadId);
  }

  private installable = (downloadId: string) => {
    const download = this.getDownload(downloadId);
    return download.state === 'finished';
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

  private pauseMulti = () => {
    this.props.selection.forEach((downloadId: string) => {
      this.context.api.events.emit('pause-download', downloadId);
    });
  }

  private pausableMulti = () => {
    return this.props.selection.find((downloadId: string) => (
      this.getDownload(downloadId).state === 'started'
    )) !== undefined;
  }

  private resumeMulti = () => {
    this.props.selection.forEach((downloadId: string) => {
      this.context.api.events.emit('resume-download', downloadId);
    });
  }

  private resumableMulti = () => {
    return this.props.selection.find((downloadId: string) => (
      this.getDownload(downloadId).state === 'paused'
    )) !== undefined;
  }

  private removeMulti = () => {
    const { t, onShowDialog, selection } = this.props;

    let downloadNames = selection.map((downloadId: string) => (
      this.getDownload(downloadId).localPath
        ));

    onShowDialog('question', 'Confirm Removal', {
      message: t('Do you really want to delete this archive?',
        { count: selection.length, replace: { count: selection.length } })
      + '\n' + downloadNames.join('\n'),
    }, {
        Cancel: null,
        Remove: () => {
          selection.forEach((downloadId: string) => {
            this.remove(downloadId);
          });
        },
      });
  }

  private removableMulti = () => {
    const match = ['finished', 'failed'];
    return this.props.selection.find((downloadId: string) => (
      match.indexOf(this.getDownload(downloadId).state) >= 0
    )) !== undefined;
  }

  private cancelableMulti = () => {
    const match = ['init', 'started', 'paused'];
    return this.props.selection.find((downloadId: string) => (
      match.indexOf(this.getDownload(downloadId).state) >= 0
    )) !== undefined;
  }

  private installMulti = () => {
    this.props.selection.forEach((downloadId: string) => {
      this.context.api.events.emit('start-install-download', downloadId);
    });
  }

  private installableMulti = () => {
    return this.props.selection.find(
      (id: string) => this.getDownload(id).state === 'finished'
    ) !== undefined;
  }
}

// create a caching query function for the current table selection
const getSelection = makeGetSelection('downloads');

function mapStateToProps(state: any): IConnectedProps {
  return {
    gameMode: state.settings.gameMode.current,
    knownGames: state.session.gameMode.known,
    downloads: state.persistent.downloads.files,
    downloadPath: downloadPath(state),
    selection: getSelection(state),
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
    translate(['common'], { wait: false })(DownloadView)
  );
