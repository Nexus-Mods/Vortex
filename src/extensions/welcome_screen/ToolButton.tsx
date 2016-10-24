import { IGame } from '../../types/IGame';
import { ISupportedTool } from '../../types/ISupportedTool';
import { ComponentEx, translate } from '../../util/ComponentEx';
import { log } from '../../util/log';
import { Button } from '../../views/TooltipControls';

import { IToolDiscoveryResult } from '../gamemode_management/types/IStateEx';

import { ContextMenu, ContextMenuLayer, MenuItem } from 'react-contextmenu';

import * as fs from 'fs';

import { execFile } from 'child_process';
import { remote } from 'electron';
import * as path from 'path';
import * as React from 'react';

interface IRemoveTool {
  (gameId: string, toolId: string): void;
}

interface IProps {
  game: IGame;
  tool: ISupportedTool;
  discovery: IToolDiscoveryResult;
  onChangeToolLocation: (gameId: string, toolId: string, result: IToolDiscoveryResult) => void;
  onRemoveTool: IRemoveTool;
  onAddNewTool: (toolPath: string) => void;
}

interface IContextMenuProps {
  id: string;
  tool: ISupportedTool;
  gameId: string;
  onRemoveTool: IRemoveTool;
  onAddNewTool: (toolPath: string) => void;
}

class MyContextMenu extends ComponentEx<IContextMenuProps, {}> {
  private currentItem: any;

  public render(): JSX.Element {
    let { t, id, tool } = this.props;
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
        <MenuItem data={tool} onClick={this.runCustomTool}>
          {t('Lsunch custom {{name}} ')}
        </MenuItem>
      </ContextMenu>
    );
  }

  private nop = () => undefined;

  private runCustomTool = (e, data) => {
    log('info', 'Launch custom tool', {});
    execFile(data.path, (err, data) => {
      if (err) {
        log('info', 'error', { err });
        return;
      }
    });
  };

  private handleRemoveClick = (e, data) => {
    let { gameId, onRemoveTool } = this.props;
    log('info', 'remove', {});
    onRemoveTool(gameId, data.id);
  }

  private handleChangeSettingsClick = (e, data) => {
    log('info', 'change', {});
  }

  private handleAddClick = (e, data) => {
    let {onAddNewTool} = this.props;
    log('info', 'add', {});

    const options: Electron.OpenDialogOptions = {
      title: 'Select tool binary',
      properties: ['openFile'],
      filters: [
        { name: 'All Executables', extensions: ['exe', 'cmd', 'bat', 'jar', 'py'] },
        { name: 'Native', extensions: ['exe', 'cmd', 'bat'] },
        { name: 'Java', extensions: ['jar'] },
        { name: 'Python', extensions: ['py'] },
      ],
    };

    remote.dialog.showOpenDialog(null, options, (fileNames: string[]) => {
      if ((fileNames !== undefined) && (fileNames.length > 0)) {
        onAddNewTool(fileNames[0]);
      }
    });
  }
}

class ToolButton extends ComponentEx<IProps, {}> {
  public render() {
    const { t, game, tool, discovery, onAddNewTool, onRemoveTool } = this.props;
    const valid = discovery !== undefined;
    let logoPath: string;
    let toolIconsPath: string = path.join(remote.app.getPath('userData'),
      'games', game.id, tool.id + '.png');

    if (fs.existsSync(toolIconsPath)) {
      logoPath = toolIconsPath;
    } else {
      logoPath = path.join(game.pluginPath, tool.logo !== '' ? tool.logo : 'no-icon.png');
    }
    return (
      <Button
        key={tool.id}
        className={tool.name + '-logo'}
        width='32'
        id='tool-button'
        tooltip={tool.name}
        height='32'
        title={tool.name}
        onClick={valid ? this.runTool : this.handleChangeLocation}
        >
        <img
          src={logoPath}
          style={valid ? {} : { filter: 'grayscale(100%)' }}
          height='32'
          width='32'
          />
        <MyContextMenu
          id={`tool-menu-${tool.id}`}
          tool={tool}
          gameId={game.id}
          onRemoveTool={onRemoveTool}
          onAddNewTool={onAddNewTool}
          t={t}
          />
      </Button>
    );
  }

  private handleChangeLocation = () => {
    const { discovery, game, tool, onChangeToolLocation } = this.props;

    const options: Electron.OpenDialogOptions = {
      title: 'Select tool binary',
      properties: ['openFile'],
      filters: [
        { name: 'All Executables', extensions: ['exe', 'cmd', 'bat', 'jar', 'py'] },
        { name: 'Native', extensions: ['exe', 'cmd', 'bat'] },
        { name: 'Java', extensions: ['jar'] },
        { name: 'Python', extensions: ['py'] },
      ],
    };

    remote.dialog.showOpenDialog(null, options, (fileNames: string[]) => {
      if ((fileNames !== undefined) && (fileNames.length > 0)) {
        let newToolSettings: IToolDiscoveryResult = { path: null };
        if (discovery !== undefined) {
          newToolSettings = Object.assign({}, discovery);
        }
        newToolSettings.path = fileNames[0];
        onChangeToolLocation(game.id, tool.id, newToolSettings);
      }
    });
  }

  private runTool = () => {
    const { discovery } = this.props;

    execFile(discovery.path, (err, data) => {
      if (err) {
        log('info', 'error', { err });
        return;
      }
    });
  };
}

class Wrapper extends React.Component<any, any> {
  public render() {
    let Layer = ContextMenuLayer('tool-menu-' + this.props.tool.id)(ToolButton);
    return <div style={{ float: 'left' }}><Layer {...this.props} /></div>;
  }
}

export default translate(['common'], { wait: true })(Wrapper);
