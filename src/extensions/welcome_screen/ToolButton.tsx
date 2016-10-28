import { IGame } from '../../types/IGame';
import { ISupportedTool } from '../../types/ISupportedTool';
import { ComponentEx, translate } from '../../util/ComponentEx';
import { log } from '../../util/log';
import Icon from '../../views/Icon';
import { Button } from '../../views/TooltipControls';

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

interface IContextMenuProps {
  id: string;
  tool: ISupportedTool;
  gameId: string;
  discovery: boolean;
  onRemoveTool: IRemoveTool;
  onAddNewTool: () => void;
  onChangeToolParams: (toolId: string) => void;
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
        <MenuItem
          data={tool}
          onClick={discovery ? this.handleChangeSettingsClick : null}
          style={discovery ? {} : { color: '#ff0000' }}
        >
          {t('Change {{name}} settings', { name: tool.name })}
        </MenuItem>
        <MenuItem divider onClick={this.nop} />
        <MenuItem data={tool} onClick={this.handleAddClick}>
          {t('Add new Tool')}
        </MenuItem>
        <MenuItem divider onClick={this.nop} />
        <MenuItem data={tool} onClick={this.runCustomTool}>
          {t('Launch custom {{name}} ')}
        </MenuItem>
      </ContextMenu>
    );
  }

  private nop = () => undefined;

  private runCustomTool = (e, data) => {
    execFile(data.path, (err, output) => {
      if (err) {
        log('info', 'error', { err });
        return;
      }
    });
  };

  private handleRemoveClick = (e, data) => {
    let { gameId, onRemoveTool } = this.props;
    onRemoveTool(gameId, data.id);
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
            imageUrl: { $set: defaultPath }
          }));
        }
      });
  }

  public render() {
    const { t, game, toolId, tool, onAddNewTool, onRemoveTool } = this.props;
    const valid = tool.path !== undefined;

    return (
      <Button
        key={toolId}
        id='tool-button'
        tooltip={tool.name}
        title={tool.name}
        onClick={valid ? this.runTool : this.handleEditTool}
      >
        <ToolIcon imageUrl={this.state.imageUrl} imageId={this.mImageId} valid={valid}/>
        <MyContextMenu
          id={`tool-menu-${toolId}`}
          tool={tool}
          gameId={game.id}
          discovery={valid}
          onRemoveTool={onRemoveTool}
          onAddNewTool={onAddNewTool}
          onChangeToolParams={this.handleEditTool}
          t={t}
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
    const { tool } = this.props;

    execFile(tool.path, (err, data) => {
      if (err) {
        log('error', 'failed to spawn', { err, path: tool.path });
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

export default translate(['common'], { wait: true })(Wrapper) as React.ComponentClass<IProps>;
