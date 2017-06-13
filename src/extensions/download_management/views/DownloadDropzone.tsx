import { DialogType, IDialogActions, IDialogContent,
         IDialogResult, showDialog } from '../../../actions/notifications';
import { IComponentContext } from '../../../types/IComponentContext';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { log } from '../../../util/log';
import { activeGameId, downloadPath } from '../../../util/selectors';


import { finishDownload, initDownload,
         removeDownload, setDownloadFilePath } from '../actions/state';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as update from 'immutability-helper';
import * as path from 'path';
import * as PropTypes from 'prop-types';
import * as React from 'react';
import { generate as shortid } from 'shortid';

interface IConnectedProps {
  downloadPath: string;
  gameMode: string;
}

interface IActionProps {
  onStartMove: (id: string, filePath: string, game: string) => void;
  onFinishMove: (id: string) => void;
  onMoveFailed: (id: string) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: IDialogActions) => Promise<IDialogResult>;
}

interface IComponentState {
  dropActive: 'no' | 'url' | 'file' | 'hover' | 'invalid';
}

type IProps = IConnectedProps & IActionProps;

class DownloadDropzone extends ComponentEx<IProps, IComponentState> {
  public static contextTypes: React.ValidationMap<any> = {
    api: PropTypes.object.isRequired,
  };

  public context: IComponentContext;

  constructor(props) {
    super(props);

    this.state = {
      dropActive: 'no',
    };
  }

  public render(): JSX.Element {
    const { t } = this.props;

    const classes = [ 'dropzone-url' ];
    if (this.state.dropActive === 'invalid') {
      classes.push('hover-invalid');
    } else if (this.state.dropActive === 'hover') {
      classes.push('hover-click');
    } else if (this.state.dropActive !== 'no') {
      classes.push('hover-valid');
    }

    return (
      <div
        className={classes.join(' ')}
        onDragEnter={this.onDragEnter}
        onDragOver={this.onDragOver}
        onDragLeave={this.onDragLeave}
        onDrop={this.onDrop}
        onMouseOver={this.onHover}
        onMouseLeave={this.onHoverLeave}
        onClick={this.onClick}
      >
        {this.state.dropActive === 'hover' ? t('Click to enter URL') : t('Drop URL or File')}
      </div>
    );
  }

  private onDragEnter = (evt: React.DragEvent<any>) => {
    evt.preventDefault();
    let type = 'invalid';
    if (evt.dataTransfer.getData('Url') !== '') {
      type = 'url';
    } else if (evt.dataTransfer.files.length > 0) {
      type = 'file';
    }
    this.setState(update(this.state, {
      dropActive: { $set: type },
    }));
  }

  private onDragOver = (evt: React.DragEvent<any>) => {
    evt.preventDefault();
    evt.stopPropagation();
    try {
      evt.dataTransfer.dropEffect = this.state.dropActive === 'url' ? 'link' : 'move';
    } catch (err) {
      // continue regardless of error
    }
    return false;
  }

  private onDragLeave = (evt: React.DragEvent<any>) => {
    evt.preventDefault();
    this.setState(update(this.state, {
      dropActive: { $set: 'no' },
    }));
  }

  private onDrop = (evt: React.DragEvent<any>) => {
    const { downloadPath } = this.props;
    evt.preventDefault();
    const url = evt.dataTransfer.getData('Url');
    if (url !== '') {
      this.context.api.events.emit('start-download', [url], {});
    } else if (evt.dataTransfer.files.length > 0) {
      const item = evt.dataTransfer.files.item(0);
      const destination = path.join(downloadPath, item.name);
      this.move((item as any).path, destination);
    }
    this.setState(update(this.state, {
      dropActive: { $set: 'no' },
    }));
  }

  private onHover = (evt) => {
    this.setState(update(this.state, {
      dropActive: { $set: 'hover' },
    }));
  }

  private onHoverLeave = (evt) => {
    this.setState(update(this.state, {
      dropActive: { $set: 'no' },
    }));
  }

  private onClick = () => {
    const { onShowDialog } = this.props;
    onShowDialog('info', 'Enter URL', {
      input: [{
        id: 'url',
        type: 'url',
      }],
    }, {
      Cancel: null,
      Download: null,
    }).then(result => {
      if (result.action === 'Download') {
        this.context.api.events.emit(
          'start-download', [result.input.url], {});
      }
    });
  }

  private move(source: string, destination: string) {
    const { gameMode, onStartMove, onFinishMove, onMoveFailed } = this.props;
    const id = shortid();
    onStartMove(id, destination, gameMode);
    fs.renameAsync(source, destination)
      .catch((err) => {
        if (err.code === 'EXDEV') {
          // can't rename cross devices, copy&unlink it is
          return fs.copyAsync(source, destination)
            .then(() => {
              return fs.unlink(source);
            });
        } else {
          throw err;
        }
      })
      .then(() => onFinishMove(id) )
      .catch((err) => {
        log('info', 'failed to move', { err });
        onMoveFailed(id);
      });
  }
}

function mapStateToProps(state): IConnectedProps {
  return {
    downloadPath: downloadPath(state),
    gameMode: activeGameId(state),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onStartMove: (id: string, filePath: string, game: string) => {
      dispatch(initDownload(id, [], {}, game));
      dispatch(setDownloadFilePath(id, path.basename(filePath)));
    },
    onFinishMove: (id: string) => dispatch(finishDownload(id, 'finished')),
    onMoveFailed: (id: string) => dispatch(removeDownload(id)),
    onShowDialog: (type: DialogType, title: string,
                   content: IDialogContent, actions: IDialogActions) =>
      dispatch(showDialog(type, title, content, actions)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      DownloadDropzone)) as React.ComponentClass<{}>;
