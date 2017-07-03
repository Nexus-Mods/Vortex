import { addFeedbackFile, removeFeedbackFile } from '../actions/session';
import { IFeedbackFile } from '../types/IFeedbackFile';

import * as Promise from 'bluebird';
import { dialog as dialogIn, Electron, remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as update from 'immutability-helper';
import { actions, ComponentEx, selectors, types } from 'nmm-api';
import * as path from 'path';
import * as PropTypes from 'prop-types';
import * as React from 'react';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';

const dialog = remote !== undefined ? remote.dialog : dialogIn;

export interface IBaseProps {
  feedbackType: string;
}

interface IConnectedProps {
  gameMode: string;
}

interface IActionProps {
  onShowDialog: (
    type: types.DialogType,
    title: string,
    content: types.IDialogContent,
    actions: types.IDialogActions,
  ) => Promise<types.IDialogResult>;
  onAddFeedbackFile: (feedbackFile: IFeedbackFile) => void;
}

interface IComponentState {
  dropActive: 'no' | 'file' | 'hover' | 'invalid';
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class FeedbackDropzone extends ComponentEx<IProps, IComponentState> {
  public static contextTypes: React.ValidationMap<any> = {
    api: PropTypes.object.isRequired,
  };

  constructor(props) {
    super(props);

    this.state = {
      dropActive: 'no',
    };
  }

  public render(): JSX.Element {
    const { feedbackType, t } = this.props;

    const classes = ['dropzone-feedback'];
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
        onDragLeave={this.onDragLeave}
        onDrop={this.onDrop}
        onMouseOver={this.onHover}
        onMouseLeave={this.onHoverLeave}
        onClick={this.onClick}
      >
        {this.state.dropActive === 'hover' ? t('Click to select the ' + feedbackType)
          : t('Drag the ' + feedbackType + ' here')}
      </div>
    );
  }

  private onDragEnter = (evt: React.DragEvent<any>) => {
    evt.stopPropagation();
    evt.preventDefault();
    let type = 'invalid';
    if (evt.dataTransfer.files.length > 0) {
      type = 'file';
    }
    this.setState(update(this.state, {
      dropActive: { $set: type },
    }));
  }

  private onDragLeave = (evt: React.DragEvent<any>) => {
    evt.preventDefault();
    this.setState(update(this.state, {
      dropActive: { $set: 'no' },
    }));
  }

  private onDrop = (evt: React.DragEvent<any>) => {

    const { feedbackType, gameMode, onAddFeedbackFile } = this.props;

    if (evt.dataTransfer.files[0] !== undefined) {
      const feedbackFile: IFeedbackFile = {
        filename: evt.dataTransfer.files[0].name,
        filePath: (evt.dataTransfer.files[0] as any).path,
        size: evt.dataTransfer.files[0].size,
        type: feedbackType,
        gameId: gameMode,
      };

      onAddFeedbackFile(feedbackFile);
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
    const { feedbackType, gameMode, onAddFeedbackFile } = this.props;

    const options: Electron.OpenDialogOptions = {
      properties: ['openFile'],
    };

    dialog.showOpenDialog(null, options, (fileNames: string[]) => {
      if ((fileNames !== undefined) && (fileNames.length > 0)) {

        fs.statAsync(fileNames[0])
          .then((stats) => {
            const feedbackFile: IFeedbackFile = {
              filename: path.basename(fileNames[0]),
              filePath: fileNames[0],
              size: stats.size,
              type: feedbackType,
              gameId: gameMode,
            };

            onAddFeedbackFile(feedbackFile);
          });
      }
    });
  }
}

function mapStateToProps(state): IConnectedProps {
  return {
    gameMode: selectors.activeGameId(state),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onShowDialog: (type, title, content, dialogActions) =>
      dispatch(actions.showDialog(type, title, content, dialogActions)),
    onAddFeedbackFile: (feedbackFile) => dispatch(addFeedbackFile(feedbackFile)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      FeedbackDropzone)) as React.ComponentClass<IBaseProps>;
