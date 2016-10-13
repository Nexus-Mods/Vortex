import { IGame } from '../../types/IGame';
import { ISupportedTool } from '../../types/ISupportedTool';
import { log } from '../../util/log';
import { Button } from '../../views/TooltipControls';

import { IToolDiscoveryResult } from '../gamemode_management/types/IStateEx';

import { execFile } from 'child_process';
import { remote } from 'electron';
import * as path from 'path';
import * as React from 'react';

interface IProps {
  game: IGame;
  tool: ISupportedTool;
  discovery: IToolDiscoveryResult;
  onChangeToolLocation: (gameId: string, toolId: string, result: IToolDiscoveryResult) => void;
}

export class ToolButton extends React.Component<IProps, {}> {
  public render() {
    const { game, tool, discovery } = this.props;

    const valid = discovery !== undefined;
    const logoPath = path.join(game.pluginPath, tool.logo);

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
      </Button>
    );
  }

  private runTool = () => {
    const { discovery } = this.props;
    execFile(discovery.path, (err, data) => {
      if (err) {
        log('info', 'error', { err });
        return;
      }
    });
  }

  private handleChangeLocation = () => {
    const { game, tool, discovery, onChangeToolLocation } = this.props;

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
}
