import { IGame } from '../../types/IGame';
import { ISupportedTool } from '../../types/ISupportedTool';
import { log } from '../../util/log';
import { Button } from '../../views/TooltipControls';

import { IToolDiscoveryResult } from '../gamemode_management/types/IStateEx';

import { ContextMenu, ContextMenuLayer, MenuItem } from 'react-contextmenu';

import { execFile } from 'child_process';
import { remote } from 'electron';
import * as path from 'path';
import * as React from 'react';

interface IProps {
  game: IGame;
  tool: ISupportedTool;
  discovery: IToolDiscoveryResult;
  onChangeToolLocation: (gameId: string, toolId: string, result: IToolDiscoveryResult) => void;
  onRemoveTool: (gameId: string, toolId: string) => void;
}

export class ToolButton extends React.Component<IProps, {}> {
  public render() {
    const { game, tool, discovery, onChangeToolLocation, onRemoveTool } = this.props;
    const valid = discovery !== undefined;
    const MyComponent = ContextMenuLayer('some_unique_identifier')(
  React.createClass({
    render() {
      const logoPath = path.join(game.pluginPath, tool.logo);
      return (<Button
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
        <MyContextMenu />
      </Button>);
    },
    handleChangeLocation(e, data) {
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
  },
  runTool(e, data) {
    execFile(discovery.path, (err, data) => {
      if (err) {
        log('info', 'error', { err });
        return;
      }
    });
  },
  })
);

    const MyContextMenu = React.createClass({
      render() {

        return (
          <ContextMenu identifier="some_unique_identifier" currentItem={this.currentItem} >
            <MenuItem data={tool} onClick={this.handleRemoveClick}>
            {'Remove ' + tool.name}
                </MenuItem>
            <MenuItem data={tool} onClick={this.handleChangeSettingsClick}>
              {'Change' + tool.name + 'settings'}
                </MenuItem>
            <MenuItem divider />
            <MenuItem data={tool} onClick={this.handleAddClick}>
              Add new Tool
                </MenuItem>
          </ContextMenu>
        );
      },
      handleRemoveClick(e, data) {
        log('info', 'remove', { });
        onRemoveTool(game.id, data);
      },
      handleChangeSettingsClick(e, data) {
        log('info', 'change', { });
      },
      handleAddClick(e, data) {
        log('info', 'add', { });
      }
    });

    return (
        <MyComponent className='react-context-menu-item' {...this.props}>
        <MyContextMenu />
        </MyComponent>
    );
  }
}
