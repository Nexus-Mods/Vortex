import { DialogActions, DialogType, IConditionResult, IDialogContent,
         IDialogResult, IInput, showDialog } from '../actions/notifications';

import { IState } from '../types/IState';
import { ConditionResults } from '../types/IDialog';
import { ComponentEx, connect, translate } from '../util/ComponentEx';
import { truthy } from '../util/util';
import { isMacOS } from '../util/platform';

import Icon from './Icon';

import Promise from 'bluebird';

import * as React from 'react';
import { WithTranslation } from 'react-i18next';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import * as url from 'url';

export type DropType = 'urls' | 'files';

export interface IBaseProps {
  drop: (type: DropType, paths: string[]) => void;
  accept: DropType[];
  dropText?: string;
  clickText?: string;
  icon?: string;
  clickable?: boolean;
  dialogHint?: string;
  dialogDefault?: string;
  style?: React.CSSProperties;
  dragOverlay?: JSX.Element;
}

interface IConnectedProps {}

interface IActionProps {
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
}

type DropMode = 'no' | 'url' | 'file' | 'hover' | 'invalid';

interface IComponentState {
  dropActive: DropMode;
}

type IProps = IBaseProps & IConnectedProps & IActionProps & WithTranslation;

class Dropzone extends ComponentEx<IProps, IComponentState> {
  private mWrapperMode: boolean = false;
  private mLeaveDelay: NodeJS.Timeout;
  constructor(props: IProps) {
    super(props);

    this.initState({
      dropActive: 'no',
    });
  }

  public componentDidMount() {
    // Add macOS-specific event listener for file drops
    if (isMacOS() && this.context.api) {
      this.context.api.events.on('open-file', this.handleMacOSFileDrop);
    }
  }

  public componentWillUnmount() {
    // Clean up macOS-specific event listener
    if (isMacOS() && this.context.api) {
      this.context.api.events.removeListener('open-file', this.handleMacOSFileDrop);
    }
  }

  public render(): JSX.Element {
    const { t, dropText, clickText, icon, clickable, style, dragOverlay } = this.props;
    const { dropActive } = this.state;

    const dropModeToStyle: { [key in DropMode]: string } = {
      'no': 'stand-alone',
      'url': 'stand-alone hover-valid',
      'file': 'stand-alone hover-valid',
      'hover': 'stand-alone hover-click',
      'invalid': 'stand-alone hover-invalid',
    };

    return (
      <div
        className={`dropzone ${dropModeToStyle[dropActive]}`}
        style={style}
        onDragOver={this.onDragOver}
        onDragLeave={this.onDragLeave}
        onDragEnd={this.onDragLeave}
        onDrop={this.onDrop}
        onClick={clickable ? this.onClick : undefined}
      >
        <div className='dropzone-content'>
          {icon !== undefined ? <Icon name={icon} /> : null}
          <p>{dropActive === 'no' ? (dropText || t('Drop files or links here')) : t('Drop now')}</p>
          {clickText !== undefined ? <p>{clickText}</p> : null}
        </div>
        {dropActive !== 'no' ? dragOverlay : null}
      </div>
    );
  }

  private handleMacOSFileDrop = (filePath: string) => {
    // Handle file dropped on macOS dock icon
    if (this.props.accept.includes('files')) {
      this.props.drop('files', [filePath]);
    }
  }

  private validateURL = (content: IDialogContent): ConditionResults => {
    const { t } = this.props;
    const urlInput = content.input?.find(input => input.id === 'url');
    const urlValue = urlInput?.value || '';
    
    if (!truthy(urlValue)) {
      return [{ 
        actions: ['confirm'], 
        errorText: t('Please enter a URL'), 
        id: 'url' 
      }];
    }
    try {
      const parsed = url.parse(urlValue);
      if ((parsed.protocol !== 'http:') && (parsed.protocol !== 'https:')) {
        return [{ 
          actions: ['confirm'], 
          errorText: t('Invalid protocol "{{proto}}", only http and https are supported',
                      { replace: { proto: parsed.protocol } }), 
          id: 'url' 
        }];
      }
    } catch (err) {
      return [{ 
        actions: ['confirm'], 
        errorText: t('Invalid URL'), 
        id: 'url' 
      }];
    }

    return [];
  }

  private setDropMode(evt: React.DragEvent<any>) {
    const { accept } = this.props;

    let newMode: DropMode = 'invalid';

    if ((evt.dataTransfer.types.indexOf('Url') !== -1)
        && (accept.indexOf('urls') !== -1)) {
      newMode = 'url';
    } else if ((evt.dataTransfer.files.length > 0)
        && (accept.indexOf('files') !== -1)) {
      newMode = 'file';
    }

    this.nextState.dropActive = newMode;
  }

  private onDragOver = (evt: React.DragEvent<any>) => {
    const { dropActive } = this.state;
    evt.preventDefault();

    if (this.state.dropActive === 'no') {
      this.setDropMode(evt);
    }

    try {
      evt.dataTransfer.dropEffect = this.state.dropActive === 'url'
        ? 'link'
        : 'copy';
    } catch (err) {
      // continue regardless of error
    }
    return false;
  }

  private onDragLeave = (evt: React.DragEvent<any>) => {
    if (['no', 'invalid'].indexOf(this.state.dropActive) !== -1) {
      return;
    }

    evt.preventDefault();
    if (this.mLeaveDelay !== undefined) {
      clearTimeout(this.mLeaveDelay);
    }
    // delay event on drag leave,
    this.mLeaveDelay = setTimeout(() => {
      this.nextState.dropActive = 'no';
    }, 100);
  }

  private onDrop = (evt: React.DragEvent<any>) => {
    const { accept, drop } = this.props;
    evt.preventDefault();

    const dropUrl = evt.dataTransfer.getData('Url');
    if ((dropUrl !== '') && (accept.indexOf('urls') !== -1)) {
      drop('urls', [dropUrl]);
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
        condition: this.validateURL,
      }, [ { label: 'Cancel' }, { label: 'Download', default: true } ])
        .then(result => {
          if (result.action === 'Download') {
            let inputUrl = result.input.url;
            if (!truthy(url.parse(inputUrl).protocol)) {
              // no protocol specified
              inputUrl = 'https://' + inputUrl;
            }
            this.props.drop('urls', [inputUrl]);
          }
        });
    } else {
      this.context.api.selectFile({
        defaultPath: dialogDefault,
        title: dialogHint,
      }).then(filePath => {
        if (filePath !== undefined) {
          this.props.drop('files', [filePath]);
        }
      });
    }
  }
}

export default translate(['common'])(
  connect<IConnectedProps, IActionProps, IBaseProps, IState>(
    undefined,
    (dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps => ({
      onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                     actions: DialogActions) =>
        dispatch(showDialog(type, title, content, actions)),
    }),
  )(Dropzone)) as React.ComponentClass<IBaseProps>;