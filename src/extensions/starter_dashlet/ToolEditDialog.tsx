import { displayGroup } from '../../actions/session';
import { FormPathItem, FormTextItem } from '../../controls/FormFields';
import { Button, IconButton } from '../../controls/TooltipControls';
import { IComponentContext } from '../../types/IComponentContext';
import { IDiscoveredTool } from '../../types/IDiscoveredTool';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import StarterInfo, { IStarterInfo } from '../../util/StarterInfo';

import { getSafe } from '../../util/storeHelper';

import { addDiscoveredTool, setGameParameters } from '../gamemode_management/actions/settings';

import ToolIcon from './ToolIcon';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as I18next from 'i18next';
import { extractIconToFile } from 'icon-extract';
import * as path from 'path';
import * as PropTypes from 'prop-types';
import * as React from 'react';
import { Col, ControlLabel, Form, FormControl, FormGroup, InputGroup, ListGroup,
         ListGroupItem, Modal } from 'react-bootstrap';
import * as Redux from 'redux';

interface IEnvButtonProps {
  t: I18next.TranslationFunction;
  variable?: { key: string, value: string };
  open: boolean;
  onOpen: (itemId: string) => void;
  onRemove: (key: string) => void;
  onAdd: (key: string, value: string) => void;
}

interface IEnvButtonState {
  varCopy: { key: string, value: string };
}

class EnvButton extends ComponentEx<IEnvButtonProps, IEnvButtonState> {

  constructor(props: IEnvButtonProps) {
    super(props);
    this.initState({ varCopy: { ...props.variable } });
  }

  public componentWillReceiveProps(newProps: IEnvButtonProps) {
    this.nextState.varCopy = { ...newProps.variable };
  }

  public render(): JSX.Element {
    const { t, open } = this.props;
    const { varCopy } = this.state;

    const key = getSafe(varCopy, ['key'], '');

    if (open) {
      return (
        <InputGroup>
          <FormControl
            type='text'
            value={key}
            onChange={this.editKey}
            placeholder={t('Key')}
            style={{ width: '50%' }}
          />{' '}
          <FormControl
            type='text'
            value={getSafe(varCopy, ['value'], '')}
            onChange={this.editValue}
            placeholder={t('Value')}
            style={{ width: '50%' }}
          />
          <InputGroup.Button>
            <IconButton
              id={`btn-apply-${key}`}
              icon='check'
              tooltip={t('Apply')}
              onClick={this.apply}
            />
          </InputGroup.Button>
        </InputGroup>
      );
    } else {
      if (varCopy.key === undefined) {
        return (
          <IconButton
            id='btn-add-env'
            icon='plus'
            tooltip={t('Add')}
            onClick={this.open}
          />
        );
      } else {
        return (
          <div>
            <b>{varCopy.key}</b> = <b>{varCopy.value}</b>{' '}
            <div className='env-edit-buttons'>
              <IconButton
                id={`btn-edit-${varCopy.key}`}
                icon='edit'
                tooltip={t('Edit')}
                onClick={this.open}
              />
              <IconButton
                id={`btn-remove-${varCopy.key}`}
                icon='remove'
                tooltip={t('Remove')}
                onClick={this.remove}
              />
            </div>
          </div>
        );
      }
    }
  }

  private editKey = (evt: React.FormEvent<any>) => {
    this.nextState.varCopy.key = evt.currentTarget.value;
  }

  private editValue = (evt: React.FormEvent<any>) => {
    this.nextState.varCopy.value = evt.currentTarget.value;
  }

  private apply = () => {
    const { onAdd, onOpen, onRemove, variable } = this.props;
    const { varCopy } = this.state;
    if (variable !== undefined) {
      onRemove(variable.key);
    }
    if ((varCopy.key !== undefined) && (varCopy.key.length > 0)) {
      onAdd(varCopy.key, varCopy.value);
    }
    onOpen(undefined);
  }

  private open = () => {
    const { onOpen, variable } = this.props;
    onOpen(variable !== undefined ? variable.key : '__add');
  }

  private remove = () => {
    const { onRemove, variable } = this.props;
    onRemove(variable.key);
  }
}

export interface IBaseProps {
  tool: StarterInfo;
  onClose: () => void;
}

interface IConnectedProps {
  displayGroups: { [id: string]: string };
}

interface IActionProps {
  onAddTool: (gameId: string, toolId: string, result: IDiscoveredTool) => void;
  onSetGameParameters: (gameId: string, parameters: any) => void;
  onEditEnv: (itemId: string) => void;
}

interface IToolEditState {
  tool: IStarterInfo;
  imageId: number;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class ToolEditDialog extends ComponentEx<IProps, IToolEditState> {
  public static contextTypes: React.ValidationMap<any> = {
    api: PropTypes.object.isRequired,
  };

  public context: IComponentContext;

  constructor(props: IProps) {
    super(props);
    this.initState({
      tool: { ...props.tool },
      imageId: new Date().getTime(),
    });
  }

  public render(): JSX.Element {
    const { t, onClose } = this.props;
    const { tool } = this.state;
    let realName: string = tool.name;
    if ((realName === undefined) && (this.props.tool !== undefined)) {
      realName = this.props.tool.name;
    }

    return (
      <Modal show={true} onHide={onClose}>
        <Modal.Header>
          <Modal.Title>
            {realName}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form horizontal>
            <FormTextItem
              t={t}
              controlId='name'
              label={t('Name')}
              placeholder={t('Name')}
              stateKey='name'
              value={realName}
              onChangeValue={this.handleChange}
              maxLength={50}
            />
            {tool.isGame ? (
              <FormTextItem
                t={t}
                controlId='target'
                label={t('Target')}
                placeholder={t('Target')}
                stateKey='target'
                value={tool.exePath}
                readOnly
              />
            ) : (
                <FormPathItem
                  t={t}
                  controlId='target'
                  label={t('Target')}
                  placeholder={t('Target')}
                  stateKey='exePath'
                  value={tool.exePath}
                  onChangeValue={this.handleChangePath}
                  directory={false}
                />
              )
            }
            <FormTextItem
              t={t}
              controlId='cmdline'
              label={t('Command Line')}
              placeholder={t('Command Line Parameters')}
              stateKey='commandLine'
              value={tool.commandLine.join(' ')}
              onChangeValue={this.handleChangeParameters}
            />

            <FormPathItem
                t={t}
                controlId='workingdir'
                label={t('Start In')}
                placeholder={t('Working Directory')}
                stateKey='workingDirectory'
                value={tool.workingDirectory}
                onChangeValue={this.handleChange}
                directory={true}
                readOnly={tool.isGame}
            />

            <FormGroup>
              <Col sm={3}>
                <ControlLabel>{t('Environment Variables')}</ControlLabel>
              </Col>
              <Col sm={9}>
                {this.renderEnvironment(tool.environment)}
              </Col>
            </FormGroup>

            <FormGroup>
              <Col sm={3}>
                <ControlLabel>{t('Icon')}</ControlLabel>
              </Col>
              <Col sm={9}>
                <FormControl.Static>
                  <Button
                    id='change-tool-icon'
                    tooltip={t('Change')}
                    onClick={this.handleChangeIcon}
                  >
                    <ToolIcon
                      imageUrl={this.props.tool.iconPath}
                      imageId={this.state.imageId}
                      valid={true}
                    />
                  </Button>
                </FormControl.Static>
              </Col>
            </FormGroup>
          </Form>
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

  private renderEnvironment(environment: { [key: string]: string } = {}): JSX.Element {
    const {t, displayGroups, onEditEnv} = this.props;
    const envList = Object.keys(environment).map((key) => ({
      key,
      value: environment[key],
    }));

    const group = getSafe(displayGroups, ['envEdit'], undefined);

    const editEnv = (itemId: string) => onEditEnv(itemId);

    return (
    <ListGroup>
        {envList.map(env => (
          <ListGroupItem key={env.key}>
            <EnvButton
              t={t}
              variable={env}
              open={group === env.key}
              onAdd={this.addEnv}
              onRemove={this.removeEnv}
              onOpen={editEnv}
            />
          </ListGroupItem>
        ))
      }
      <ListGroupItem key='__add'>
        <EnvButton
          t={t}
          open={group === '__add'}
          onAdd={this.addEnv}
          onRemove={this.removeEnv}
          onOpen={editEnv}
        />
      </ListGroupItem>
    </ListGroup>);
  }

  private addEnv = (key: string, value: string) => {
    this.nextState.tool.environment[key] = value;
  }

  private removeEnv = (key: string) => {
    delete this.nextState.tool.environment[key];
  }

  private clearCache() {
    this.nextState.imageId = new Date().getTime();
  }

  private handleChange = (field: string, value: any): void => {
    this.nextState.tool[field] = value;
  }

  private handleChangeParameters = (key, value) => {
    this.handleChange('commandLine', value.split(' '));
  }

  private handleChangePath = (field: 'exePath', filePath: string) => {
    const { tool } = this.props;

    this.handleChange('exePath', filePath);
    if (!this.state.tool.name) {
      this.handleChange('name', path.basename(filePath, path.extname(filePath)));
    }
    if (!this.state.tool.workingDirectory) {
      this.handleChange('workingDirectory', path.dirname(filePath));
    }
    this.useImage(filePath);
  }

  private handleChangeIcon = () => {
    const { t } = this.props;

    // TODO: implement conversion from other file formats to png and resizing
    this.context.api.selectFile({
      defaultPath: this.state.tool.exePath,
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
    const destPath = tool.iconOutPath;

    return fs.ensureDirAsync(path.dirname(destPath))
      .then(() => (path.extname(filePath) === '.exe')
        ? new Promise<void>((resolve, reject) => {
          extractIconToFile(filePath, destPath, (err) => {
            if (err !== null) {
              reject(err);
            } else {
              resolve();
            }
          }, 32, 'png');
        })
        : fs.copyAsync(filePath, destPath))
      .then(() => {
        this.clearCache();
        this.forceUpdate();
      })
      .catch((err) => {
        if (err !== null) {
          this.context.api.showErrorNotification('failed to change tool icon', err.message);
        }
      });
  }

  private toToolDiscovery(tool: IStarterInfo): IDiscoveredTool {
    return {
      path: tool.exePath,
      hidden: false,
      custom: true,
      workingDirectory: tool.workingDirectory,
      id: tool.id,
      name: tool.name,
      executable: null,
      requiredFiles: [],
      environment: tool.environment,
      logo: `${tool.id}.png`,
      parameters: tool.commandLine,
    };
  }

  private saveAndClose = () => {
    const { onAddTool, onClose, onSetGameParameters } = this.props;
    const { tool } = this.state;
    if (tool.isGame) {
      onSetGameParameters(tool.gameId, {
        workingDirectory: tool.workingDirectory,
        iconPath: tool.iconPath,
        environment: tool.environment,
        commandLine: tool.commandLine,
      });
    } else {
      onAddTool(tool.gameId, tool.id, this.toToolDiscovery(tool));
    }
    onClose();
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    displayGroups: state.session.base.displayGroups,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onAddTool: (gameId, toolId, result) => dispatch(addDiscoveredTool(gameId, toolId, result)),
    onEditEnv: (itemId: string) => dispatch(displayGroup('envEdit', itemId)),
    onSetGameParameters: (gameId, parameters) => dispatch(setGameParameters(gameId, parameters)),
  };
}

export default
  translate([ 'common' ], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      ToolEditDialog)) as React.ComponentClass<IBaseProps>;
