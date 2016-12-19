import { IDiscoveredTool } from '../../types/IDiscoveredTool';
import { IGame } from '../../types/IGame';
import { ITool } from '../../types/ITool';
import { ComponentEx, translate } from '../../util/ComponentEx';
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
import { Image } from 'react-bootstrap';
import { ContextMenu, ContextMenuLayer, MenuItem } from 'react-contextmenu';
import { generate as shortid } from 'shortid';

export interface IRemoveTool {
  (gameId: string, toolId: string): void;
}

interface IContextMenuProps {
  id: string;
  tool: ITool | IDiscoveredTool;
  gameId: string;
  discovery: boolean;
  onRemoveTool: IRemoveTool;
  onAddNewTool: () => void;
  onChangeToolParams: (toolId: string) => void;
  onShowError: (message: string, details?: string) => void;
}

// run the specified tool in a separate process with elevated
// permissions
function runToolElevated(tool: IDiscoveredTool,
                         onError: (message: string, details: string) => void) {
  let toolCWD = tool.currentWorkingDirectory !== undefined ?
    tool.currentWorkingDirectory : path.dirname(tool.path);
  let elevatedTool = {
    id: tool.id,
    toolPath: tool.path.replace(/\\/g, '\\\\'),
    parameters: tool.parameters,
    toolCWD,
  };

  // the ipc path has to be different every time so that
  // the ipc lib doesn't report EADDRINUSE when the same tool
  // is started multiple times.
  // Also node-ipc has a bug and would crash the application
  // if that were to happen
  const ipcPath: string = 'tool_elevated_' + shortid();
  // communicate with the elevated process via ipc
  ipc.serve(ipcPath, () => {
    ipc.server.on('finished', (modPath: string) => {
      ipc.server.stop();
    });
    ipc.server.on('socket.disconnected', () => {
      log('info', 'disconnected');
    });
    ipc.server.on('log', (ipcData: any) => {
      log(ipcData.level, ipcData.message, ipcData.meta);
      onError(ipcData.message, ipcData.meta.err);
    });
    // run it
    elevated(ipcPath, runElevatedCustomTool,
      elevatedTool);
  });
  ipc.server.start();
}

class MyContextMenu extends ComponentEx<IContextMenuProps, {}> {
  private currentItem: any;

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
            runToolElevated(data, this.props.onShowError);
          }
        });
      } else {
        log('info', 'failed to run custom tool', { err });
      }
    }
  };

  private handleRemoveClick = (e, data: IDiscoveredTool) => {
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

export interface IProps {
  game: IGame;
  toolId: string;
  tool: ITool | IDiscoveredTool;
  onChangeToolLocation: (gameId: string, toolId: string, result: IDiscoveredTool) => void;
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

  constructor(props: IProps) {
    super(props);

    this.state = {
      imageUrl: undefined,
    };

    // TODO the following really should be asynchronous but that would require
    // a setstate and react doesn't seem to like any setState outside event
    // handlers
    try {
      const customIconUrl = this.toolIconPath(this.props.tool.id);
      fs.statSync(customIconUrl);
      this.state.imageUrl = customIconUrl;
    } catch (err) {
      if ((props.tool !== undefined) && (props.tool.logo !== undefined)) {
        const defaultPath = path.join(props.game.pluginPath, props.tool.logo);
        this.state.imageUrl = defaultPath;
      }
    }
  }

  public componentDidMount() {
    this.mImageId = new Date().getTime();
  }

  public render() {
    const { t, game, toolId, tool, onAddNewTool, onRemoveTool, onShowError } = this.props;
    let toolPath = (tool as IDiscoveredTool).path;
    const valid = (toolPath !== undefined) && (toolPath !== '');

    return (
      <Button
        key={toolId}
        id='tool-button'
        tooltip={tool.name}
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
    let { onShowError, tool } = this.props;
    // we shouldn't get here if the tool is not discovered
    let discoveredTool = tool as IDiscoveredTool;
    try {
      let execOptions = {
        cwd: discoveredTool.currentWorkingDirectory !== undefined ?
        discoveredTool.currentWorkingDirectory : path.dirname(discoveredTool.path),
      };

      execFile(discoveredTool.path, discoveredTool.parameters, execOptions, (err, output) => {
        if (err) {
          log('error', 'failed to spawn', { err, path: discoveredTool.path });
        }
      });
    } catch (err) {
      if (err.errno === 'UNKNOWN') {
        const {dialog} = require('electron').remote;
        dialog.showMessageBox({
          buttons: ['Ok', 'Cancel'],
          title: 'Missing elevation',
          message: tool.name + ' cannot be started because it requires elevation. ' +
          'Would you like to run the tool elevated?',
        }, (buttonIndex) => {
          if (buttonIndex === 0) {
            runToolElevated(discoveredTool, onShowError);
          }
        });
      } else {
        log('info', 'failed to run custom tool', { err: err.message });
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

export default translate(['common'], { wait: false })(Wrapper) as React.ComponentClass<IProps>;
