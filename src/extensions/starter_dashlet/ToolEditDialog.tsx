import { displayGroup } from '../../actions/session';
import { FormPathItem, FormTextItem } from '../../controls/FormFields';
import More from '../../controls/More';
import Toggle from '../../controls/Toggle';
import { Button, IconButton } from '../../controls/TooltipControls';
import { IComponentContext } from '../../types/IComponentContext';
import { IDiscoveredTool } from '../../types/IDiscoveredTool';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import { ProcessCanceled, UserCanceled } from '../../util/CustomErrors';
import Debouncer from '../../util/Debouncer';
import * as fs from '../../util/fs';
import { TFunction } from '../../util/i18n';
import StarterInfo, { IStarterInfo } from '../../util/StarterInfo';
import { getSafe } from '../../util/storeHelper';

import { addDiscoveredTool, setGameParameters } from '../gamemode_management/actions/settings';

import ToolIcon from './ToolIcon';

import Promise from 'bluebird';
import { remote } from 'electron';
import * as _ from 'lodash';
import * as path from 'path';
import * as PropTypes from 'prop-types';
import * as React from 'react';
import { Col, ControlLabel, Form, FormControl, FormGroup, InputGroup, ListGroup,
         ListGroupItem, Modal, ToggleButton, ToggleButtonGroup } from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

const {app} = remote;

interface IEnvButtonProps {
  t: TFunction;
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

  public UNSAFE_componentWillReceiveProps(newProps: IEnvButtonProps) {
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
              icon='input-confirm'
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
            icon='add'
            tooltip={t('Add')}
            onClick={this.open}
          />
        );
      } else {
        return (
          <div className='env-kvpair'>
            <div>
              <b>{varCopy.key}</b> = <b>{varCopy.value}</b>
            </div>
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

interface IEditStarterInfo {
  id: string;
  gameId: string;
  isGame: boolean;
  iconPath: string;
  iconOutPath: string;
  name: string;
  exePath: string;
  commandLine: string;
  workingDirectory: string;
  environment: { [key: string]: string };
  shell: boolean;
  detach: boolean;
  onStart?: 'hide' | 'hide_recover' | 'close';
  defaultPrimary?: boolean;
  exclusive?: boolean;
}

interface IToolEditState {
  tool: IEditStarterInfo;
  imageId: number;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

class ToolEditDialog extends ComponentEx<IProps, IToolEditState> {
  public static contextTypes: React.ValidationMap<any> = {
    api: PropTypes.object.isRequired,
  };

  public context: IComponentContext;
  private mUpdateImageDebouncer: Debouncer;

  constructor(props: IProps) {
    super(props);
    this.initState({
      tool: this.toEditStarter(props.tool),
      imageId: Date.now(),
    });
    this.mUpdateImageDebouncer = new Debouncer((imagePath: string) =>
      this.useImage(imagePath), 2000);
  }

  public render(): JSX.Element {
    const { t, onClose } = this.props;
    const { imageId, tool } = this.state;
    let realName: string = tool.name;
    if ((realName === undefined) && (this.props.tool !== undefined)) {
      realName = this.props.tool.name;
    }

    const haveEnvironment: boolean = Object.keys(tool.environment).length > 0;

    return (
      <Modal show={true} onHide={onClose} id='tool-edit-dialog'>
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
                readOnly={tool.isGame}
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
              value={tool.commandLine}
              onChangeValue={this.handleChangeParameters}
            />

            <FormPathItem
                t={t}
                controlId='workingdir'
                label={t('Start In')}
                placeholder={(tool.exePath !== undefined)
                  ? path.dirname(tool.exePath)
                  : t('Select the executable first')}
                stateKey='workingDirectory'
                value={tool.workingDirectory}
                onChangeValue={this.handleChange}
                directory={true}
                readOnly={tool.isGame}
            />

            <FormGroup
              validationState={haveEnvironment ? 'warning' : undefined}
            >

              <Col sm={3}>
                <ControlLabel>{t('Environment Variables')}</ControlLabel>
              </Col>
              <Col sm={9}>
                {this.renderEnvironment(tool.environment)}
                {haveEnvironment ? (
                  <ControlLabel style={{ paddingTop: 0 }}>
                    {t('Tools with environments can\'t be started from the "Tasks" list')}
                  </ControlLabel>
                ) : null}
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
                      imageUrl={tool.iconPath}
                      imageId={imageId}
                      valid={true}
                    />
                  </Button>
                </FormControl.Static>
              </Col>
            </FormGroup>
            <FormGroup>
              <Col sm={3}>
                <ControlLabel>
                  {t('On Start')}
                  <More id='on-start' name={t('On Start behavior')}>
                    {t('Use these options if you don\'t want to leave the Vortex window '
                      + 'open while the game is running. In some games this may be necessary '
                      + 'to avoid performance problems.\n\n'
                      + 'The "Close Vortex" option will close Vortex entirely, meaning it '
                      + 'will not use any system resources. This is not usually necessary.\n'
                      + 'The hide options will hide Vortex to the system tray so the window '
                      + 'isn\'t rendered at all.\n'
                      + 'With the "restore when closed" option the Vortex window will '
                      + 'automatically reappear. Please be aware that this option will not '
                      + 'work correctly if you start the game via a "proxy", e.g. the script '
                      + 'extenders for Elder Scrolls/Fallout games because Vortex will '
                      + 'reappear as soon as the proxy closes.')}
                  </More>
                </ControlLabel>
              </Col>
              <Col sm={9}>
                <ToggleButtonGroup
                  name='onstart'
                  type='radio'
                  value={tool.onStart}
                  onChange={this.setStartEvent}
                >
                  <ToggleButton
                    value='nothing'
                  >
                    {t('Nothing')}
                  </ToggleButton>
                  <ToggleButton
                    value='hide'
                  >
                    {t('Hide Vortex')}
                  </ToggleButton>
                  <ToggleButton
                    value='hide_recover'
                  >
                    {t('Hide Vortex, restore when closed')}
                  </ToggleButton>
                  <ToggleButton
                    value='close'
                  >
                    {t('Close Vortex')}
                  </ToggleButton>
                </ToggleButtonGroup>
              </Col>
            </FormGroup>
            <FormGroup>
              <Col sm={12}>
                <Toggle checked={tool.shell} onToggle={this.toggleShell}>
                  {t('Run in shell')}
                  <More id='run-in-shell' name={t('Run in shell')}>
                    {t('If (and only if!) a tool is written as a console '
                         + 'application, you have to enable this to allow it to run '
                         + 'correctly.')}
                  </More>
                </Toggle>
              </Col>
            </FormGroup>
            <FormGroup>
              <Col sm={12}>
                <Toggle
                  disabled={tool.onStart === 'close'}
                  checked={tool.detach}
                  onToggle={this.toggleDetached}
                >
                  {t('Run detached')}
                  <More id='run-detached' name={t('Run detached')}>
                    {t('Run the tool as a detached process (default). When you disable this '
                     + 'the game/tool will run as a child process and thus if Vortex '
                     + 'quits, the tool will also be terminated.')}
                  </More>
                </Toggle>
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
      </ListGroup>
    );
  }

  private addEnv = (key: string, value: string) => {
    this.nextState.tool.environment[key] = value;
  }

  private removeEnv = (key: string) => {
    delete this.nextState.tool.environment[key];
  }

  private clearCache() {
    this.nextState.imageId = Date.now();
  }

  private handleChange = (field: string, value: any): void => {
    this.nextState.tool[field] = value;
  }

  private splitCommandLine(input: string): string[] {
    const res = [];
    let inBrackets = false;
    let startOffset = 0;

    const completeWord = (i) => {
      res.push(input.slice(startOffset, i));
      startOffset = i + 1;
    };

    for (let i = 0; i < input.length; ++i) {
      if ((input[i] === ' ') && (i > startOffset) && !inBrackets) {
        completeWord(i);
      } else if (input[i] === '"') {
        inBrackets = !inBrackets;
      }
    }
    if (input.length > startOffset) {
      completeWord(input.length);
    }

    return res;
  }

  private handleChangeParameters = (key, value) => {
    this.handleChange('commandLine', value);
  }

  private handleChangePath = (field: 'exePath', filePath: string) => {
    this.handleChange('exePath', filePath);
    if (!this.state.tool.name) {
      this.handleChange('name', path.basename(filePath, path.extname(filePath)));
    }
    // don't replace a logo set through the setup code
    if (this.props.tool.logoName === undefined) {
      this.mUpdateImageDebouncer.schedule(undefined, filePath);
    }
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

  private toggleShell = () => {
    this.nextState.tool.shell = !this.state.tool.shell;
  }

  private toggleDetached = () => {
    this.nextState.tool.detach = !this.state.tool.detach;
  }

  private setStartEvent = (mode: 'nothing' | 'hide' | 'hide_recover' | 'close') => {
    this.nextState.tool.onStart = mode === 'nothing' ? undefined : mode;
    if ((mode === 'close') && !this.state.tool.detach) {
      this.nextState.tool.detach = true;
    }
  }

  private useImage(filePath: string): Promise<void> {
    const { tool } = this.props;
    const destPath = tool.iconOutPath;

    if (destPath === filePath) {
      return Promise.resolve();
    }

    return fs.statAsync(filePath)
      .catch(err => Promise.reject(new ProcessCanceled('invalid file')))
      .then(stats => stats.isDirectory()
          ? Promise.reject(new ProcessCanceled('is a directory'))
          : Promise.resolve())
      .then(() => fs.ensureDirAsync(path.dirname(destPath)))
      .then(() => (path.extname(filePath) === '.exe')
        ? app.getFileIcon(filePath, { size: 'normal' })
          .then(icon => fs.writeFileAsync(destPath, icon.toPNG()))
        : fs.copyAsync(filePath, destPath))
      .then(() => {
        this.clearCache();
        this.nextState.tool.iconPath = destPath;
      })
      .catch(UserCanceled, () => null)
      .catch(ProcessCanceled, () => null)
      .catch((err) => {
        this.context.api.showErrorNotification('Failed to change tool icon', err,
                                               { allowReport: false });
      });
  }

  private toEditStarter(input: IStarterInfo): IEditStarterInfo {
    const temp: any = {
      ...input,
      iconPath: StarterInfo.getIconPath(input),
    };
    temp.commandLine = temp.commandLine.join(' ');
    temp.environment = { ...input.environment };
    return temp;
  }

  private toToolDiscovery(tool: IEditStarterInfo): IDiscoveredTool {
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
      parameters: this.splitCommandLine(tool.commandLine),
      shell: tool.shell,
      detach: tool.detach,
      onStart: tool.onStart,
      defaultPrimary: tool.defaultPrimary,
      exclusive: tool.exclusive,
    };
  }

  private saveAndClose = () => {
    const { onAddTool, onClose, onSetGameParameters } = this.props;
    const { tool } = this.state;
    if (tool.isGame) {
      const envCustomized = !_.isEqual(tool.environment, this.props.tool.originalEnvironment);
      onSetGameParameters(tool.gameId, {
        workingDirectory: tool.workingDirectory,
        iconPath: tool.iconPath,
        environment: tool.environment,
        envCustomized,
        parameters: this.splitCommandLine(tool.commandLine),
        shell: tool.shell,
        detach: tool.detach,
        onStart: tool.onStart,
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

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onAddTool: (gameId, toolId, result) => dispatch(addDiscoveredTool(gameId, toolId, result)),
    onEditEnv: (itemId: string) => dispatch(displayGroup('envEdit', itemId)),
    onSetGameParameters: (gameId, parameters) => dispatch(setGameParameters(gameId, parameters)),
  };
}

export default
  translate([ 'common' ])(
    connect(mapStateToProps, mapDispatchToProps)(
      ToolEditDialog)) as React.ComponentClass<IBaseProps>;
