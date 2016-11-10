import { IGame } from '../../types/IGame';
import { ISupportedTool } from '../../types/ISupportedTool';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import { log } from '../../util/log';
import Icon from '../../views/Icon';
import { Button } from '../../views/TooltipControls';

import elevated from '../../util/elevated';

import ipc = require('node-ipc');

import runElevatedCustomTool from './runElevatedCustomTool';

import { execFile } from 'child_process';
import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as React from 'react';
import update = require('react-addons-update');
import { Image } from 'react-bootstrap';
import { ContextMenu, ContextMenuLayer, MenuItem } from 'react-contextmenu';

interface IRemoveTool {
  (gameId: string, toolId: string): void;
}

interface IElevatedSupportedTool {
  id: string;
  toolPath?: string;
  parameters?: string;
}

interface IContextMenuProps {
  id: string;
  tool: ISupportedTool;
  gameId: string;
  discovery: boolean;
  onRemoveTool: IRemoveTool;
  onAddNewTool: () => void;
  onChangeToolParams: (toolId: string) => void;
  onShowError: (message: string, details?: string) => void;
}

class MyContextMenu extends ComponentEx<IContextMenuProps, {}> {
  private currentItem: any;
  private mElevatedClient: any = null;

  public render(): JSX.Element {
    let { t, id, discovery, tool } = this.props;

    return (
      <ContextMenu identifier={id} currentItem={this.currentItem} >
        <MenuItem data={tool} onClick={this.handleRemoveClick}>
          {t('Remove {{name}}', { name: tool.name })}
        </MenuItem>
        <MenuItem data={tool} onClick={this.handleChangeSettingsClick}>
          {t('Change {{name}} settings', { name: tool.name })}
        </MenuItem>
        <MenuItem divider onClick={this.nop} />
        <MenuItem data={tool} onClick={this.handleAddClick}>
          {t('Add new Tool')}
        </MenuItem>
        <MenuItem divider onClick={this.nop} />
        <MenuItem
          data={tool}
          disabled={!discovery}
          onClick={this.runCustomTool}
        >
          {t('Launch {{name}}', { name: tool.name })}
        </MenuItem>
      </ContextMenu>
    );
  }

  private nop = () => undefined;

  private runCustomTool = (e, data) => {
    let { onShowError } = this.props;

    try {
      let params: string[] = data.parameters.split(' ');
      execFile(data.path, params, (err, output) => {
        if (err) {
          log('info', 'error', { err });
          return;
        }
      });
    } catch (err) {
      if (err.errno === 'UNKNOWN') {
        const {dialog} = require('electron').remote;
        dialog.showMessageBox({
          buttons: ['Ok', 'Cancel'],
          title: 'Missing elevation',
          message: data.id + ' cannot be started because it requires elevation. ' +
          'Would you like to run the tool elevated?',
        }, (buttonIndex) => {
          if (buttonIndex === 0) {
            let elevatedTool: IElevatedSupportedTool = {
              id: data.id,
              toolPath: data.path.replace(/\\/g, '\\\\'),
              parameters: data.parameters,
            };

            const ipcPath: string = 'tool_elevated_' + data.id;
            ipc.serve(ipcPath, () => {
              ipc.server.on('initialised', (ipcData, socket) => {
                this.mElevatedClient = socket;
                ipc.server.emit(this.mElevatedClient, 'run-elevated-tool');
              });
              ipc.server.on('finished', (modPath: string) => {
                ipc.server.emit(this.mElevatedClient, 'quit');
                ipc.server.stop();
              });
              ipc.server.on('socket.disconnected', () => {
                ipc.server.stop();
                this.mElevatedClient = null;
              });
              ipc.server.on('log', (ipcData: any) => {
                log(ipcData.level, ipcData.message, ipcData.meta);
                onShowError(ipcData.message, ipcData.meta.err);
              });
              elevated('tool_elevated_' + data.id, runElevatedCustomTool,
                elevatedTool, undefined);
            });
            ipc.server.start();
          }
        });
      } else {
        log('info', 'runCustomToolError', { err });
      }
    }
  };

  private handleRemoveClick = (e, data: ISupportedTool) => {
    let { gameId, onRemoveTool } = this.props;
    if (data.id !== undefined) {
      onRemoveTool(gameId, data.id);
    }
  }

  private handleChangeSettingsClick = (e, data) => {
    let {onChangeToolParams } = this.props;
    onChangeToolParams(data.id);
  }

  private handleAddClick = (e, data) => {
    this.props.onAddNewTool();
  }
}

interface IProps {
  game: IGame;
  toolId: string;
  tool: ISupportedTool;
  onChangeToolLocation: (gameId: string, toolId: string, result: ISupportedTool) => void;
  onRemoveTool: IRemoveTool;
  onAddNewTool: () => void;
  onChangeToolParams: (toolId: string) => void;
  onShowError: (message: string, details?: string) => void;
}

interface IToolButtonState {
  imageUrl: string;
}

const ToolIcon = (props) => {
  const validClass = props.valid ? 'valid' : 'invalid';
  if (props.imageUrl !== undefined) {
    return (
      <Image
        src={`${props.imageUrl}?${props.imageId}`}
        className={'tool-icon ' + validClass}
      />
    );
  } else {
    return (
      <Icon
        name='question-circle'
        className={'tool-icon ' + validClass}
      />
    );
  }
};

class ToolButton extends ComponentEx<IProps, IToolButtonState> {
  private mImageId: number;
  private mElevatedClient: any = null;

  constructor(props: IProps) {
    super(props);

    this.state = {
      imageUrl: undefined,
    };
  }

  public componentDidMount() {
    this.mImageId = new Date().getTime();
    const customIconUrl = this.toolIconPath(this.props.tool.id);
    fs.statAsync(customIconUrl)
      .then((stat: fs.Stats) => {
        this.setState(update(this.state, {
          imageUrl: { $set: customIconUrl },
        }));
      })
      .catch(() => {
        const { game, tool } = this.props;
        if ((tool !== undefined) && (tool.logo !== undefined)) {
          const defaultPath = path.join(game.pluginPath, tool.logo);
          this.setState(update(this.state, {
            imageUrl: { $set: defaultPath },
          }));
        }
      });
  }

  public render() {
    const { t, game, toolId, tool, onAddNewTool, onRemoveTool, onShowError } = this.props;
    const valid = tool.path !== undefined;

    return (
      <Button
        key={toolId}
        id='tool-button'
        tooltip={tool.name}
        title={tool.name}
        onClick={valid ? this.runTool : this.handleEditTool}
      >
        <ToolIcon imageUrl={this.state.imageUrl} imageId={this.mImageId} valid={valid} />
        <MyContextMenu
          id={`tool-menu-${toolId}`}
          tool={tool}
          gameId={game.id}
          discovery={valid}
          onRemoveTool={onRemoveTool}
          onAddNewTool={onAddNewTool}
          onChangeToolParams={this.handleEditTool}
          t={t}
          onShowError={onShowError}
        />
      </Button>
    );
  }

  private toolIconPath(toolName: string) {
    let { game } = this.props;
    return path.join(remote.app.getPath('userData'),
      game.id, 'icons', toolName + '.png');
  }

  private handleEditTool = () => {
    this.props.onChangeToolParams(this.props.tool.id);
  }

  private runTool = () => {
    let { onShowError } = this.props;
    try {
      let params: string[] = this.props.tool.parameters.split(' ');
      execFile(this.props.tool.path, params, (err, output) => {
        if (err) {
          log('error', 'failed to spawn', { err, path: this.props.tool.path });
        }
      });
    } catch (err) {
      if (err.errno === 'UNKNOWN') {
        const {dialog} = require('electron').remote;
        dialog.showMessageBox({
          buttons: ['Ok', 'Cancel'],
          title: 'Missing elevation',
          message: this.props.tool.id + ' cannot be started because it requires elevation. ' +
          'Would you like to run the tool elevated?',
        }, (buttonIndex) => {
          if (buttonIndex === 0) {
            let elevatedTool: IElevatedSupportedTool = {
              id: this.props.tool.id,
              toolPath: this.props.tool.path.replace(/\\/g, '\\\\'),
              parameters: this.props.tool.parameters,
            };

            const ipcPath: string = 'tool_elevated_' + this.props.tool.id;
            ipc.serve(ipcPath, () => {
              ipc.server.on('initialised', (ipcData, socket) => {
                this.mElevatedClient = socket;
                ipc.server.emit(this.mElevatedClient, 'run-elevated-tool');
              });
              ipc.server.on('socket.disconnected', () => {
                ipc.server.stop();
                this.mElevatedClient = null;
              });
              ipc.server.on('log', (ipcData: any) => {
                log(ipcData.level, ipcData.message, ipcData.meta);
                onShowError(ipcData.message, ipcData.meta.err);
              });
              elevated('tool_elevated_' + this.props.tool.id, runElevatedCustomTool,
                elevatedTool, undefined);
            });
            ipc.server.start();
          }
        });
      } else {
        log('info', 'runCustomToolError', { err });
      }
    }
  };
}

class Wrapper extends React.Component<any, any> {
  public render() {
    let Layer = ContextMenuLayer('tool-menu-' + this.props.tool.id)(ToolButton);
    return <div style={{ float: 'left' }}><Layer {...this.props} /></div>;
  }
}

export default translate(['common'], { wait: true })(Wrapper) as React.ComponentClass<IProps>;
