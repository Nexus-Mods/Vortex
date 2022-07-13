import { displayGroup } from '../../actions/session';
import { FormPathItem, FormTextItem } from '../../controls/FormFields';
import More from '../../controls/More';
import Toggle from '../../controls/Toggle';
import { Button } from '../../controls/TooltipControls';
import { ThunkDispatch } from 'redux-thunk';
import { IDiscoveredTool } from '../../types/IDiscoveredTool';
import StarterInfo from '../../util/StarterInfo';

import { addDiscoveredTool, setGameParameters } from '../gamemode_management/actions/settings';

import * as selectors from '../../util/selectors';

import ToolIcon from '../../controls/ToolIcon';

import * as React from 'react';
import { Col, ControlLabel, Form, FormControl, FormGroup,
         Modal, ToggleButton, ToggleButtonGroup } from 'react-bootstrap';
import * as Redux from 'redux';
import { IGameStored } from '../gamemode_management/types/IGameStored';
import { IToolStored } from '../gamemode_management/types/IToolStored';
import { useTranslation } from 'react-i18next';

import { toDirname, isEqual, toToolDiscovery, toEditStarter, updateImage, splitCommandLine, resolveToolName } from './util';
import { MainContext } from '../../views/MainWindow';
import { ProcessCanceled, UserCanceled } from '../../util/CustomErrors';
import { useSelector } from 'react-redux';

import Environment from './Environment';

export interface IBaseProps {
  tool: StarterInfo;
  onClose: () => void;
}

interface IConnectedProps {
  displayGroups: { [id: string]: string };
  game: IGameStored;
}

interface IActionProps {
  onAddTool: (gameId: string, toolId: string, result: IDiscoveredTool) => void;
  onSetGameParameters: (gameId: string, parameters: any) => void;
  onEditEnv: (itemId: string) => void;
}

type IProps = IBaseProps;

export default function ToolEditDialog(props: IProps) {
  const { onClose, tool } = props;
  const { t } = useTranslation();
  const { game } = useSelector(mapStateToProps);
  const [imageId, setImageId] = React.useState(Date.now());
  const [editTool, setEditTool] = React.useState(toEditStarter(tool));
  const context = React.useContext(MainContext);
  const { onSetGameParameters, onAddTool, onEditEnv } = mapDispatchToProps(context.api.store.dispatch);
  let realName: string = editTool.name;
  if ((realName === undefined) && (editTool !== undefined)) {
    realName = editTool.name;
  }

  React.useEffect(() => {
    setEditTool(toEditStarter(tool));
  }, [tool, setEditTool]);

  let exePathPlaceholder = t('Target');
  const predefinedToolPath = ((game?.supportedTools ?? []).find(st => st.id === editTool.id) as IToolStored)?.executable;
  if (predefinedToolPath !== undefined) {
    exePathPlaceholder = `../${predefinedToolPath}`;
  }
  const haveEnvironment: boolean = Object.keys(editTool.environment).length > 0;

  const handleChange = React.useCallback((field: string, value: any): void => {
    const editToolChange = {
      ...editTool,
      [field]: value,
    };
    setEditTool(editToolChange);
  }, [editTool, setEditTool]);

  const addEnv = React.useCallback((key: string, value: string) => {
    const newEnv = {
      ...editTool.environment,
      [key]: value,
    };
    handleChange('environment', newEnv);
  }, [handleChange, editTool, setEditTool]);

  const removeEnv = React.useCallback((key: string) => {
    let newEnv = { ...editTool.environment };
    delete newEnv[key];
    handleChange('environment', newEnv);
  }, [handleChange, editTool]);

  const clearCache = () => {
    setImageId(Date.now());
  }

  const handleChangeParameters = React.useCallback((key, value) => {
    handleChange('commandLine', value);
  }, [handleChange]);

  const onShowError = React.useCallback((message: string, err: Error, allowReport: boolean) => {
    context.api.showErrorNotification(message, err, { allowReport });
  }, [context]);

  const onUpdateImage = React.useCallback((filePath: string) => {
    updateImage(tool, filePath, (err => {
      if (err !== null) {
        const reportable = !((err instanceof ProcessCanceled) || (err instanceof UserCanceled));
        if (reportable) {
          onShowError('Failed to change tool icon', err, false);
        }
      } else {
        clearCache();
        handleChange('iconPath', tool.iconOutPath);
      }
    }));
  }, [handleChange, clearCache, onShowError, tool]);

  const handleChangePath = React.useCallback((field: 'exePath', filePath: string) => {
    handleChange(field, filePath);
    if (!editTool.name) {
      handleChange('name', resolveToolName(editTool));
    }

    if (tool.logoName === undefined) {
      onUpdateImage(filePath);
    }
  }, [tool, handleChange, editTool, onShowError, onUpdateImage]);

  const toggleShell = () => {
    handleChange('shell', !editTool.shell);
  }

  const toggleDetached = () => {
    handleChange('detach', !editTool.detach);
  }

  const setStartEvent = React.useCallback((mode: 'nothing' | 'hide' | 'hide_recover' | 'close') => {
    editTool.onStart = mode === 'nothing' ? undefined : mode;
    if ((mode === 'close') && !editTool.detach) {
      handleChange('detach', true);
    }
  }, [handleChange, editTool]);
  const onHandleChangeIcon = () => {
    context.api.selectFile({
      defaultPath: tool.exePath,
      title: t('Select image'),
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'ico'] },
        { name: 'Executables', extensions: ['exe'] },
      ],
    })
    .then((filePath: string) => {
      if (filePath !== undefined) {
        onUpdateImage(filePath);
      }
    });
  }

  const saveAndClose = () => {
    if (editTool.isGame) {
      const envCustomized = !isEqual(editTool.environment, tool.originalEnvironment);
      onSetGameParameters(editTool.gameId, {
        workingDirectory: editTool.workingDirectory,
        iconPath: editTool.iconPath,
        environment: editTool.environment,
        envCustomized,
        parameters: splitCommandLine(editTool.commandLine),
        shell: editTool.shell,
        detach: editTool.detach,
        onStart: editTool.onStart,
      });
    } else {
      onAddTool(editTool.gameId, editTool.id, toToolDiscovery(editTool));
    }
    onClose();
    context.api.events.emit('analytics-track-click-event', 'Tools', 'Edited tool');
  }

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
            onChangeValue={handleChange}
            maxLength={50}
          />
          {editTool.isGame ? (
            <FormTextItem
              t={t}
              controlId='target'
              label={t('Target')}
              placeholder={exePathPlaceholder}
              stateKey='target'
              value={editTool.exePath}
              readOnly={editTool.isGame}
            />
          ) : (
              <FormPathItem
                t={t}
                controlId='target'
                label={t('Target')}
                placeholder={exePathPlaceholder}
                stateKey='exePath'
                value={editTool.exePath}
                onChangeValue={handleChangePath}
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
            value={editTool.commandLine}
            onChangeValue={handleChangeParameters}
          />

          <FormPathItem
              t={t}
              controlId='workingdir'
              label={t('Start In')}
              placeholder={(editTool.exePath !== undefined)
                ? toDirname(editTool.exePath)
                : t('Select the executable first')}
              stateKey='workingDirectory'
              value={editTool.workingDirectory}
              onChangeValue={handleChange}
              directory={true}
              readOnly={editTool.isGame}
          />

          <FormGroup
            validationState={haveEnvironment ? 'warning' : undefined}
          >

            <Col sm={3}>
              <ControlLabel>{t('Environment Variables')}</ControlLabel>
            </Col>
            <Col sm={9}>
              <Environment
                t={t}
                addEnv={addEnv}
                environment={editTool.environment}
                onEditEnv={onEditEnv}
                removeEnv={removeEnv}
              />
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
                  onClick={onHandleChangeIcon}
                >
                  <ToolIcon
                    item={editTool}
                    imageUrl={editTool.iconPath}
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
                value={editTool.onStart}
                onChange={setStartEvent}
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
              <Toggle checked={editTool.shell} onToggle={toggleShell}>
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
                disabled={editTool.onStart === 'close'}
                checked={editTool.detach}
                onToggle={toggleDetached}
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
          onClick={saveAndClose}
        >
          {t('Save')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// Not sure why this static variable is needed but whatever.
// ToolEditDialog.contextTypes = (props: IProps) => {
//   api: PropTypes.object.isRequired
// };

function mapStateToProps(state: any): IConnectedProps {
  return {
    displayGroups: state.session.base.displayGroups,
    game: selectors.currentGame(state),
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onAddTool: (gameId, toolId, result) =>
      dispatch(addDiscoveredTool(gameId, toolId, result, true)),
    onEditEnv: (itemId: string) => dispatch(displayGroup('envEdit', itemId)),
    onSetGameParameters: (gameId, parameters) => dispatch(setGameParameters(gameId, parameters)),
  };
}
