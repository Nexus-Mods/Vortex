import { IComponentContext } from '../../types/IComponentContext';
import { IDiscoveredTool } from '../../types/IDiscoveredTool';
import { IGame } from '../../types/IGame';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';

import Icon from '../../views/Icon';
import { Button } from '../../views/TooltipControls';

import { log } from '../../util/log';

import { addDiscoveredTool } from '../gamemode_management/actions/settings';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import { extractIconToFile } from 'icon-extract';
import * as path from 'path';
import * as React from 'react';
import update = require('react-addons-update');
import { ControlLabel, FormControl, Image, InputGroup, Modal } from 'react-bootstrap';
import * as ReactDOM from 'react-dom';

export interface IBaseProps {
  game: IGame;
  tool: IDiscoveredTool;
  onClose: () => void;
}

interface IActionProps {
  onAddTool: (gameId: string, toolId: string, result: IDiscoveredTool) => void;
}

interface IToolEditState {
  tool: IDiscoveredTool;
  imageId: number;
}

type IProps = IBaseProps & IActionProps;

class ToolEditDialog extends ComponentEx<IProps, IToolEditState> {
  public static contextTypes: React.ValidationMap<any> = {
    api: React.PropTypes.object.isRequired,
  };

  public context: IComponentContext;

  private mPathControl = null;

  constructor(props: IProps) {
    super(props);
    this.state = {
      tool: Object.assign({}, props.tool),
      imageId: new Date().getTime(),
    };
  }

  public render(): JSX.Element {
    const { t, onClose, tool } = this.props;
    let realName = this.state.tool.name;
    if ((realName === undefined) && (tool !== undefined)) {
      realName = tool.name;
    }

    let iconPath = this.toolIconPath(tool.id);

    return (
      <Modal show={true} onHide={onClose}>
        <Modal.Header>
          <Modal.Title>
            { realName }
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <ControlLabel>{ t('Name') }</ControlLabel>
          <FormControl
            type='text'
            value={ realName }
            placeholder={ t('Name') }
            onChange={ this.handleChangeName }
            maxLength={50}
          />

          <ControlLabel>{ t('Path') }</ControlLabel>
          <InputGroup>
            <FormControl
              value={this.state.tool.path}
              placeholder={t('Tool Path')}
              ref={this.setPathControl}
              readOnly
            />
            <InputGroup.Button>
              <Button
                id='change-tool-path'
                tooltip={t('Change')}
                onClick={this.handleChangePath}
              >
                <Icon name='folder-open' />
              </Button>
            </InputGroup.Button>
          </InputGroup>

           <ControlLabel>{ t('Current Working Directory') }</ControlLabel>
          <InputGroup>
            <FormControl
              value={this.state.tool.currentWorkingDirectory}
              placeholder={t('Current Working Directory')}
              readOnly
            />
            <InputGroup.Button>
              <Button
                id='change-current-working-directory-path'
                tooltip={t('Change')}
                onClick={this.setCurrentWorkingDirectoryPath}
              >
                <Icon name='folder-open' />
              </Button>
            </InputGroup.Button>
          </InputGroup>

          <ControlLabel>{ t('Command Line') }</ControlLabel>
          <FormControl
            type='text'
            value={ this.state.tool.parameters.join(' ') }
            placeholder={ t('Command Line') }
            onChange={ this.handleChangeParameters }
          />

          <ControlLabel>{ t('Icon') }</ControlLabel>
          <FormControl.Static>
            <Button
              id='change-tool-icon'
              tooltip={ t('Change') }
              onClick={ this.handleChangeIcon }
            >
              <Image src={ `${iconPath}?${this.state.imageId}` }/>
            </Button>
          </FormControl.Static>
        </Modal.Body>
        <Modal.Footer>
          <Button
            id='cancel-tool-btn'
            tooltip={t('Cancel')}
            onClick={onClose}
          >
            {t('Cancel')}
          </Button>
          <Button
            id='apply-tool-btn'
            tooltip={t('Save')}
            onClick={this.saveAndClose}
          >
            {t('Save')}
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }

  private setPathControl = (ctrl) => {
    this.mPathControl = ctrl;
  }

  private clearCache() {
    this.setState(update(this.state, {
      imageId: { $set: new Date().getTime() },
    }));
  }

  private handleChange(field: string, value: any, callback?: () => void): void {
    this.setState(update(this.state, { tool:
      { [field]: { $set: value } },
    }), callback);
  }

  private handleChangeName = (event) => {
    this.handleChange('name', event.target.value);
  }

  private handleChangeParameters = (event) => {
    this.handleChange('parameters', event.target.value.split(' '));
  }

  private setCurrentWorkingDirectoryPath = () => {
    this.context.api.selectDir({})
    .then((dirName: string) => {
      this.handleChange('currentWorkingDirectory', dirName);
    })
    .catch((err) => {
      log('info', 'search path selection cancelled', { err });
    });
  }

  private handleChangePath = () => {
    const { t, tool } = this.props;

    const iconPath = this.toolIconPath(tool.id);
    let toolPath: string;

    this.context.api.selectExecutable({
      defaultPath: this.state.tool.path,
      title: t('Select Executable'),
    })
    .then((filePath: string) => {
      if (filePath === undefined) {
        return Promise.reject(null);
      }
      this.handleChange('path', filePath, () => {
        let node: any = ReactDOM.findDOMNode(this.mPathControl);
        node.scrollLeft = node.scrollWidth;
      });
      if (!this.state.tool.name) {
        this.handleChange('name', path.basename(filePath, path.extname(filePath)));
      }
      if (!this.state.tool.currentWorkingDirectory) {
        this.handleChange('currentWorkingDirectory', path.dirname(filePath));
      }
      toolPath = filePath;
      return fs.statAsync(iconPath);
    })
    .catch(() => {
      if (toolPath !== undefined) {
        // stat failed so there is no icon yet
        this.useImage(toolPath);
      }
    });
  }

  private handleChangeIcon = () => {
    const { t } = this.props;

    // TODO implement conversion from other file formats to png and resizing
    this.context.api.selectFile({
      defaultPath: this.state.tool.path,
      title: t('Select image'),
      filters: [
        { name: 'Images', extensions: ['png'] },
        { name: 'Executables', extensions: ['exe'] },
      ],
    })
    .then((filePath: string) => {
      if (filePath !== undefined) {
        this.useImage(filePath);
      }
    });
  }

  private useImage(filePath: string): Promise<void> {
    const { tool } = this.props;
    const destPath = this.toolIconPath(tool.id);

    fs.ensureDirAsync(path.dirname(destPath));

    let promise: Promise<any>;
    if (path.extname(filePath) === '.exe') {
      promise = new Promise<boolean>((resolve, reject) => {
        extractIconToFile(filePath, destPath, (err) => {
          if (err !== null) {
            reject(err);
          } else {
            resolve();
          }
        }, 32, 'png');
      });
    } else {
      promise = fs.copyAsync(filePath, destPath);
    }

    return promise.then(() => {
      this.clearCache();
      this.forceUpdate();
    })
    .catch((err) => {
      if (err !== null) {
        this.context.api.showErrorNotification('failed to change tool icon', err.message);
      }
    });
  }

  private toolIconPath(toolName: string) {
    let { game } = this.props;
    return path.join(remote.app.getPath('userData'),
                     game.id, 'icons', toolName + '.png');
  }

  private saveAndClose = () => {
    const { onAddTool, onClose, game, tool } = this.props;
    onAddTool(game.id, tool.id, this.state.tool);
    onClose();
  }
}

function mapStateToProps(state): Object {
  return {};
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onAddTool: (gameId, toolId, result) => dispatch(addDiscoveredTool(gameId, toolId, result)),
  };
}

export default
  translate([ 'common' ], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(ToolEditDialog)
  ) as React.ComponentClass<IBaseProps>;
