import { DialogType, IDialogActions, IDialogContent,
         IDialogResult, showDialog } from '../actions/notifications';
import { IComponentContext } from '../types/IComponentContext';
import { ComponentEx, connect, translate } from '../util/ComponentEx';
import { log } from '../util/log';
import { activeGameId, downloadPath } from '../util/selectors';
import { getSafe } from '../util/storeHelper';

import * as Promise from 'bluebird';
/*
import * as fs from 'fs-extra-promise';
import * as update from 'immutability-helper';
import * as path from 'path';
*/

import * as PropTypes from 'prop-types';
import * as React from 'react';
import * as Redux from 'redux';
// import { generate as shortid } from 'shortid';

export type ControlMode = 'urls' | 'files';

export interface IBaseProps {
  drop: (type: ControlMode, paths: string[]) => void;
  accept: ControlMode[];
  dialogHint?: string;
  dialogDefault?: string;
}

interface IConnectedProps {}

interface IActionProps {
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: IDialogActions) => Promise<IDialogResult>;
}

type DropMode = 'no' | 'url' | 'file' | 'hover' | 'invalid';

interface IComponentState {
  dropActive: DropMode;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class Dropzone extends ComponentEx<IProps, IComponentState> {
  constructor(props) {
    super(props);

    this.initState({
      dropActive: 'no',
    });
  }

  public render(): JSX.Element {
    const { t, accept } = this.props;

    const classes = [ 'dropzone-url' ];
    if (this.state.dropActive === 'invalid') {
      classes.push('hover-invalid');
    } else if (this.state.dropActive === 'hover') {
      classes.push('hover-click');
    } else if (this.state.dropActive !== 'no') {
      classes.push('hover-valid');
    }

    const clickMode = accept[0] === 'urls'
      ? t('enter URL')
      : t('browse for file');

    const acceptList = accept.map(mode => {
      return {
        urls: t('URL'),
        files: t('File'),
      }[mode];
    });

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
        {this.state.dropActive === 'hover'
          ? t('Click to {{clickMode}}', { replace: { clickMode } })
          : t('Drop {{accept}}', { replace: { accept: acceptList.join(t(' or ')) } })}
      </div>
    );
  }

  private onDragEnter = (evt: React.DragEvent<any>) => {
    evt.preventDefault();
    let type: DropMode = 'invalid';
    if (evt.dataTransfer.getData('Url') !== '') {
      type = 'url';
    } else if (evt.dataTransfer.files.length > 0) {
      type = 'file';
    }
    this.nextState.dropActive = type;
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
    this.nextState.dropActive = 'no';
  }

  private onDrop = (evt: React.DragEvent<any>) => {
    const { accept, drop } = this.props;
    evt.preventDefault();

    const url = evt.dataTransfer.getData('Url');
    if ((url !== '') && (accept.indexOf('urls') !== -1)) {
      drop('urls', [url]);
    }

    if ((evt.dataTransfer.files.length > 0) && (accept.indexOf('files') !== -1)) {
      const fileList: string[] = [];
      for (let i = 0; i < evt.dataTransfer.files.length; ++i) {
        fileList.push((evt.dataTransfer.files.item(i) as any).path);
      }
      drop('files', fileList);
    }

    this.nextState.dropActive = 'no';
  }

  private onHover = (evt) => {
    this.nextState.dropActive = 'hover';
  }

  private onHoverLeave = (evt) => {
    this.nextState.dropActive = 'no';
  }

  private onClick = () => {
    const { t, accept, dialogDefault, dialogHint } = this.props;

    const clickMode = accept[0];

    if (clickMode === 'urls') {
      this.props.onShowDialog('info', dialogHint, {
        input: [{
          id: 'url',
          type: 'url',
          value: dialogDefault,
        }],
      }, {
          Cancel: null,
          Download: null,
        }).then(result => {

          if (result.action === 'Download') {
            this.props.drop('urls', [result.input.url]);
          }
        });
    } else {
      this.context.api.selectFile({
        defaultPath: dialogDefault,
        title: dialogHint,
      }).then(filePath => {
        this.props.drop('files', [filePath]);
      });
    }
  }
}

function mapStateToProps(state): IConnectedProps {
  return {
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onShowDialog: (type: DialogType, title: string,
                   content: IDialogContent, actions: IDialogActions) =>
      dispatch(showDialog(type, title, content, actions)),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      Dropzone)) as React.ComponentClass<IBaseProps>;
