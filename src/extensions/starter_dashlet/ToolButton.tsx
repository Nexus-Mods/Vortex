import { IDiscoveredTool } from '../../types/IDiscoveredTool';
import { IGame } from '../../types/IGame';
import { ComponentEx } from '../../util/ComponentEx';
import Icon from '../../views/Icon';
import { Button } from '../../views/TooltipControls';

import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as React from 'react';
import { Image } from 'react-bootstrap';
import { ContextMenu, ContextMenuLayer, MenuItem } from 'react-contextmenu';

export interface IRemoveTool {
  (gameId: string, toolId: string): void;
}

interface IContextMenuProps {
  id: string;
  tool: IDiscoveredTool;
  gameId: string;
  discovery: boolean;
  onRemoveTool: IRemoveTool;
  onRunTool: (toolId: string) => void;
  onAddNewTool: () => void;
  onChangeToolParams: (toolId: string) => void;
  onShowError: (message: string, details?: string) => void;
}

class MyContextMenu extends ComponentEx<IContextMenuProps, {}> {
  private currentItem: any;

  public render(): JSX.Element {
    let { t, id, discovery, tool } = this.props;

    return (
      <ContextMenu identifier={id} currentItem={this.currentItem} >
        <MenuItem data={tool} onClick={this.handleRemoveClick}>
          {t('Remove {{name}}', { replace: { name: tool.name } })}
        </MenuItem>
        <MenuItem data={tool} onClick={this.handleChangeSettingsClick}>
          {t('Change {{name}} settings', { replace: { name: tool.name } })}
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
          {t('Launch {{name}}', { replace: { name: tool.name } })}
        </MenuItem>
      </ContextMenu>
    );
  }

  private nop = () => undefined;

  private runCustomTool = (e, data) => {
    this.props.onRunTool(data);
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
  t: I18next.TranslationFunction;
  game: IGame;
  toolId: string;
  tool: IDiscoveredTool;
  onRunTool: (toolId: string) => void;
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
    const { t, game, toolId, tool, onAddNewTool, onRemoveTool,
            onShowError } = this.props;
    let toolPath = tool.path;
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
          onRunTool={this.props.onRunTool}
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
    let { onRunTool, tool } = this.props;
    onRunTool(tool.id);
  };
}

class Wrapper extends React.Component<any, any> {
  public render() {
    let Layer = ContextMenuLayer('tool-menu-' + this.props.tool.id)(ToolButton);
    return <div style={{ float: 'left' }}><Layer {...this.props} /></div>;
  }
}

export default Wrapper;
