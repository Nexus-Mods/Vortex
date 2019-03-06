import { showDialog } from '../../../actions/notifications';
import EmptyPlaceholder from '../../../controls/EmptyPlaceholder';
import FlexLayout from '../../../controls/FlexLayout';
import Icon from '../../../controls/Icon';
import More from '../../../controls/More';
import { Button } from '../../../controls/TooltipControls';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../../types/IDialog';
import { ValidationState } from '../../../types/ITableAttribute';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { InsufficientDiskSpace, TemporaryError,
         UnsupportedOperatingSystem, UserCanceled } from '../../../util/CustomErrors';
import * as fs from '../../../util/fs';
import getVortexPath from '../../../util/getVortexPath';
import { log } from '../../../util/log';
import { showError } from '../../../util/message';
import opn from '../../../util/opn';
import { getSafe } from '../../../util/storeHelper';
import { testPathTransfer, transferPath } from '../../../util/transferPath';
import { isChildPath } from '../../../util/util';
import { currentGame, currentGameDiscovery } from '../../gamemode_management/selectors';
import { IDiscoveryResult } from '../../gamemode_management/types/IDiscoveryResult';
import { IGameStored } from '../../gamemode_management/types/IGameStored';
import { setDeploymentNecessary } from '../actions/deployment';
import { setActivator, setInstallPath } from '../actions/settings';
import { IDeploymentMethod } from '../types/IDeploymentMethod';
import { getSupportedActivators } from '../util/deploymentMethods';
import { NoDeployment } from '../util/exceptions';
import getInstallPath, { getInstallPathPattern } from '../util/getInstallPath';

import getText from '../texts';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as path from 'path';
import * as process from 'process';
import * as React from 'react';
import {
  Alert, Button as BSButton, ControlLabel, FormControl, FormGroup,
  HelpBlock, InputGroup, Jumbotron, Modal, Panel, ProgressBar,
} from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import * as winapi from 'winapi-bindings';

interface IBaseProps {
  activators: IDeploymentMethod[];
}

interface IConnectedProps {
  game: IGameStored;
  discovery: IDiscoveryResult;
  gameMode: string;
  installPath: string;
  currentActivator: string;
  state: any;
}

interface IActionProps {
  onSetInstallPath: (gameMode: string, path: string) => void;
  onSetActivator: (gameMode: string, id: string) => void;
  onShowDialog: (
    type: DialogType,
    title: string,
    content: IDialogContent,
    actions: DialogActions,
  ) => Promise<IDialogResult>;
  onShowError: (message: string, details: string | Error, allowReport: boolean) => void;
}

interface IComponentState {
  installPath: string;
  busy: string;
  progress: number;
  supportedActivators: IDeploymentMethod[];
  currentActivator: string;
  changingActivator: boolean;
  currentPlatform: string;
}

type IProps = IBaseProps & IActionProps & IConnectedProps;

const nop = () => undefined;

class Settings extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);
    this.initState({
      busy: undefined,
      progress: 0,
      supportedActivators: [],
      currentActivator: props.currentActivator,
      installPath: props.installPath,
      changingActivator: false,
      currentPlatform: '',
    });
  }

  public componentWillMount() {
    this.nextState.supportedActivators = this.supportedActivators();
    this.nextState.currentPlatform = process.platform;
  }

  public componentWillReceiveProps(newProps: IProps) {
    if (this.props.installPath !== newProps.installPath) {
      this.nextState.installPath = newProps.installPath;
    }
  }

  public componentDidUpdate(prevProps: IProps, prevState: IComponentState) {
    if ((this.props.gameMode !== prevProps.gameMode)
        || (this.props.installPath !== prevProps.installPath)) {
      this.nextState.supportedActivators = this.supportedActivators();
      this.nextState.currentActivator = this.props.currentActivator;
    }
  }

  public render(): JSX.Element {
    const { t, discovery, game } = this.props;
    const { currentActivator, progress, supportedActivators } = this.state;

    if (game === undefined) {
      return (
        <EmptyPlaceholder
          icon='settings'
          text={t('Please select a game to manage first')}
          subtext={t('Settings on this page can be set for each game individually.')}
        />
      );
    }

    const gameName = getSafe(discovery, ['name'], getSafe(game, ['name'], undefined));

    const PanelX: any = Panel;

    return (
      // Prevent default submit event for the form as it will
      //  cause Vortex to refresh (same thing as pressing F5).
      <form onSubmit={this.submitEvt}>
        <Panel>
          <PanelX.Body>
            {this.renderPathCtrl(t('Mod Staging Folder ({{name}})',
                                 { replace: { name: gameName } }), supportedActivators)}
            <Modal show={this.state.busy !== undefined} onHide={nop}>
              <Modal.Body>
                <Jumbotron>
                  <p>{this.state.busy}</p>
                  <ProgressBar style={{ height: '1.5em' }} now={progress} />
                </Jumbotron>
              </Modal.Body>
            </Modal>
          </PanelX.Body>
        </Panel>
        <hr />
        <Panel>
          <PanelX.Body>
            <ControlLabel>
              {t('Deployment Method')}
              <More id='more-deploy' name={t('Deployment')} >
                {getText('deployment', t)}
              </More>
            </ControlLabel>
            {this.renderActivators(supportedActivators, currentActivator)}
          </PanelX.Body>
        </Panel>
      </form>
    );
  }

  private submitEvt = (evt) => {
    evt.preventDefault();
  }

  /**
   * return only those activators that are supported based on the current state
   *
   * @param {*} state
   * @returns {IDeploymentMethod[]}
   */
  private supportedActivators(): IDeploymentMethod[] {
    return getSupportedActivators(this.props.state);
  }

  private pathsChanged() {
    return this.props.installPath !== this.state.installPath;
  }

  private transferPath() {
    const { gameMode } = this.props;
    const oldPath = getInstallPath(this.props.installPath, gameMode);
    const newPath = getInstallPath(this.state.installPath, gameMode);

    return transferPath(oldPath, newPath, (from: string, to: string, progress: number) => {
      if (progress > this.state.progress) {
        this.nextState.progress = progress;
      }
    });
  }

  private applyPaths = () => {
    const { t, discovery, gameMode, onSetInstallPath, onShowDialog, onShowError } = this.props;
    const newInstallPath: string = getInstallPath(this.state.installPath, gameMode);
    const oldInstallPath: string = getInstallPath(this.props.installPath, gameMode);
    log('info', 'changing staging directory', { from: oldInstallPath, to: newInstallPath });

    const vortexPath = getVortexPath('base');

    if (isChildPath(newInstallPath, vortexPath)) {
      return onShowDialog('error', 'Invalid path selected', {
                text: 'You can not put mods into the vortex application directory. '
                  + 'This directory gets removed during updates so you would lose all your '
                  + 'files on the next update.',
      }, [ { label: 'Close' } ]);
    }

    if (isChildPath(newInstallPath, discovery.path)) {
      return onShowDialog('error', 'Invalid path selected', {
                text: 'You can not put mods into the game directory. '
                  + 'This directory is under the control of the game '
                  + '(and potentially Steam or similar) '
                  + 'so your mods might be deleted or moved or otherwise damaged by '
                  + 'foreign software.\n'
                  + 'Please choose a separate folder for staging folder, one that no other '
                  + 'application uses.',
      }, [ { label: 'Close' } ]);
    }

    if (isChildPath(oldInstallPath, newInstallPath)) {
      return onShowDialog('error', 'Invalid path selected', {
                text: 'You can\'t change the staging folder to be the parent of the old folder. '
                    + 'This is because the new staging folder has to be empty and it isn\'t '
                    + 'empty if it contains the current staging folder.\n\n'
                    + 'If your current staging folder is "{USERDATA}\\{game}\\mods\\foobar"\n'
                    + 'and you want it to be "{USERDATA}\\{game}\\mods"\n'
                    + 'you first have to set it to something like "{USERDATA}\\{game}\\mods_temp"\n'
                    + 'and then you can change it to "{USERDATA}\\{game}\\mods".',
      }, [ { label: 'Close' } ]);
    }

    const notEnoughDiskSpace = () => {
      return onShowDialog('error', 'Insufficient disk space', {
        text: 'You do not have enough disk space to move the staging folder to your '
            + 'proposed destination folder.\n\n'
            + 'Please select a different destination or free up some space and try again!',
      }, [ { label: 'Close' } ]);
    };

    // it's possible that old and new path indicate the same directory but are still different,
    // e.g. if the old path contained a variable (like {game}) and the new one has the game name
    // written out. In this case we update the setting without purging or moving anything
    const doPurge = () => oldInstallPath !== newInstallPath
      // ignore if there is no deployment method because in that case there is nothing to purge
      ? this.purgeActivation().catch(NoDeployment, () => Promise.resolve())
      : Promise.resolve();

    this.nextState.progress = 0;
    this.nextState.busy = t('Calculating required disk space');
    return testPathTransfer(oldInstallPath, newInstallPath)
      .then(() => {
        this.nextState.busy = t('Purging previous deployment');
        doPurge();
      })
      .then(() => fs.ensureDirAsync(newInstallPath))
      .then(() => {
        let queue = Promise.resolve();
        let fileCount = 0;
        if (oldInstallPath !== newInstallPath) {
          queue = queue
            .then(() => fs.readdirAsync(newInstallPath))
            .then(files => {
              fileCount += files.length;
            });
        }
        // ensure the destination directories are empty
        return queue.then(() => new Promise((resolve, reject) => {
         if (fileCount > 0) {
            this.props.onShowDialog('info', 'Invalid Destination', {
              message: 'The destination folder has to be empty',
            }, [{ label: 'Ok', action: () => reject(null) }]);
          } else {
            resolve();
          }
        }));
      })
      .then(() => {
        if (oldInstallPath !== newInstallPath) {
          this.nextState.busy = t('Moving mod staging folder');
          return this.transferPath();
        } else {
          return Promise.resolve();
        }
      })
      .then(() => {
        onSetInstallPath(gameMode, this.state.installPath);
      })
      .catch(TemporaryError, err => {
        onShowError('Failed to move directories, please try again', err, false);
      })
      .catch(UserCanceled, () => null)
      .catch(InsufficientDiskSpace, () => notEnoughDiskSpace())
      .catch(UnsupportedOperatingSystem, () =>
        onShowError('Unsupported operating system',
        'This functionality is currently unavailable for your operating system!',
        false))
      .catch((err) => {
        if (err !== null) {
          if (err.code === 'EPERM') {
            onShowError(
              'Directories are not writable',
              'You need to select directories that the current user account can write to!',
              false);
          } else if (err.code === 'EINVAL') {
            onShowError(
              'Invalid path', err.message, false);
          } else {
            onShowError('Failed to move directories', err, true);
          }
        }
      })
      .finally(() => {
        this.nextState.busy = undefined;
      });
  }

  private purgeActivation(): Promise<void> {
    const { currentActivator } = this.props;
    const { supportedActivators } = this.state;

    // can't purge if there is no deployment method but there shouldn't be
    // anything _to_ purge
    if ((supportedActivators === undefined)
        || (supportedActivators.length === 0)
        || (currentActivator === undefined)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.context.api.events.emit('purge-mods', err => err !== null
        ? reject(err)
        : resolve());
    });
  }

  private applyActivator = () => {
    const { gameMode, onSetActivator, onShowError } = this.props;
    const { currentActivator } = this.state;

    this.nextState.changingActivator = true;
    this.purgeActivation()
    .then(() => {
      onSetActivator(gameMode, currentActivator);
      this.nextState.changingActivator = false;
    })
    .then(() => { this.context.api.store.dispatch(setDeploymentNecessary(gameMode, true)); })
    .catch(UserCanceled, () => null)
    .catch(TemporaryError, err => {
      onShowError('Failed to purge previous deployment, please try again',
                  err, false);
    })
    .catch(err => {
      onShowError('Failed to purge previous deployment', err, true);
    });
  }

  private validateModPath(input: string): { state: ValidationState, reason?: string } {
    const { currentPlatform } = this.state;

    const invalidCharacters = currentPlatform === 'win32'
      ? ['/', '?', '%', '*', ':', '|', '"', '<', '>', '.']
      : [];

    let vortexPath = remote.app.getAppPath();
    if (path.basename(vortexPath) === 'app.asar') {
      // in asar builds getAppPath returns the path of the asar so need to go up 2 levels
      // (resources/app.asar)
      vortexPath = path.dirname(path.dirname(vortexPath));
    }
    if (isChildPath(input, vortexPath)) {
      return {
        state: 'error',
        reason: 'Staging folder can\'t be a subdirectory of the Vortex application folder.',
      };
    }

    if (input.length > 100) {
      return {
        state: (input.length > 200) ? 'error' : 'warning',
        reason: 'Staging path shouldn\'t be too long, otherwise mod installers may fail.',
      };
    }

    if (!path.isAbsolute(input)) {
      return {
        state: 'error',
        reason: 'Staging folder needs to be an absolute path.',
      };
    }

    const removedWinRoot = currentPlatform === 'win32' ? input.substr(3) : input;
    if (invalidCharacters.find(inv => removedWinRoot.indexOf(inv) !== -1) !== undefined) {
      return {
        state: 'error',
        reason: 'Path cannot contain illegal characters',
      };
    }

    return {
      state: 'success',
    };
  }

  private renderPathCtrl(label: string, activators: IDeploymentMethod[]): JSX.Element {
    const { t, gameMode } = this.props;
    const { installPath } = this.state;

    const pathPreview = getInstallPath(installPath, gameMode);
    const validationState = this.validateModPath(pathPreview);

    return (
      <FormGroup id='install-path-form' validationState={validationState.state}>
        <ControlLabel>
          {label}
          <More id='more-paths' name={t('Paths')} >
            {getText('paths', t)}
          </More>
        </ControlLabel>
        <FlexLayout type='row'>
          <FlexLayout.Fixed>
            <InputGroup>
              <FormControl
                className='install-path-input'
                value={getInstallPathPattern(installPath)}
                placeholder={label}
                onChange={this.changePathEvt}
                onKeyPress={(this.pathsChanged() && (validationState.state !== 'error'))
                             ? this.keyPressEvt : null}
              />
              <InputGroup.Button className='inset-btn'>
                <Button
                  tooltip={t('Browse')}
                  onClick={this.browsePath}
                >
                  <Icon name='browse' />
                </Button>
              </InputGroup.Button>
            </InputGroup>
          </FlexLayout.Fixed>
          <FlexLayout.Fixed>
            <InputGroup.Button>
              {((activators === undefined) || (activators.length === 0)) ? (
                <Button
                  onClick={this.suggestPath}
                  tooltip={t('This will suggest a path that should allow you to '
                           + 'deploy mods for the current game')}
                >
                  {t('Suggest')}
                </Button>
              ) : null}
              <BSButton
                disabled={!this.pathsChanged() || (validationState.state === 'error')}
                onClick={this.applyPaths}
              >
                {t('Apply')}
              </BSButton>
            </InputGroup.Button>
          </FlexLayout.Fixed>
        </FlexLayout>
        <HelpBlock><a data-url={pathPreview} onClick={this.openUrl}>{pathPreview}</a></HelpBlock>
        {validationState.reason ? <ControlLabel>{t(validationState.reason)}</ControlLabel> : null}
      </FormGroup>
    );
  }

  private keyPressEvt = (evt) => {
    if (evt.which === 13) {
      evt.preventDefault();
      this.applyPaths();
    }
  }

  private suggestPath = () => {
    const { discovery } = this.props;
    Promise.join(fs.statAsync(discovery.path), fs.statAsync(remote.app.getPath('userData')))
      .then(stats => {
        let suggestion: string;
        if (stats[0].dev === stats[1].dev) {
          suggestion = path.join('{USERDATA}', '{game}', 'mods');
        } else {
          const volume = winapi.GetVolumePathName(discovery.path);
          suggestion = path.join(volume, 'Vortex Mods', '{game}');
        }
        this.changePath(suggestion);
      });
  }

  private changePathEvt = (evt) => {
    const target: HTMLInputElement = evt.target as HTMLInputElement;
    this.changePath(target.value);
  }

  private changePath = (value: string) => {
    this.nextState.installPath = value;
  }

  private openUrl = (evt) => {
    const url = evt.currentTarget.getAttribute('data-url');
    opn(url).catch(() => undefined);
  }

  private browsePath = () => {
    this.context.api.selectDir({})
      .then((selectedPath: string) => {
        if (selectedPath) {
          this.changePath(selectedPath);
        }
      });
  }

  private renderActivators(activators: IDeploymentMethod[], currentActivator: string): JSX.Element {
    const { t } = this.props;
    const { changingActivator } = this.state;

    let content: JSX.Element;
    let activatorIdx: number = -1;

    const changed = currentActivator !== this.props.currentActivator;

    if ((activators !== undefined) && (activators.length > 0)) {
      if (currentActivator !== undefined) {
        activatorIdx = activators.findIndex((activator) => activator.id === currentActivator);
      }

      content = (
        <div>
          <FormControl
            componentClass='select'
            value={currentActivator}
            onChange={this.selectActivator}
          >
            {activators.map(this.renderActivatorOption)}
          </FormControl>
        </div>
      );
    } else {
      content = (
        <ControlLabel>
          <Alert bsStyle='danger'>
            <h4 style={{ marginBottom: 0 }}>{t('No deployment method available.')}</h4>
            <p style={{ marginTop: 0 }}>{t('See notification for more information.')}</p>
          </Alert>
        </ControlLabel>
      );
    }

    return (
      <FormGroup validationState={activators !== undefined ? undefined : 'error'}>
        <InputGroup>
          {content}
          <InputGroup.Button>
            <BSButton
              disabled={!changed || changingActivator}
              onClick={this.applyActivator}
            >
              {t('Apply')}
            </BSButton>
          </InputGroup.Button>
        </InputGroup>
        { activatorIdx !== -1 ? (
          <HelpBlock>
            {t(activators[activatorIdx].description)}
            <More id='more-activator-detail' name={activators[activatorIdx].name}>
              {activators[activatorIdx].detailedDescription(t)}
            </More>
          </HelpBlock>
        ) : null }
      </FormGroup>
    );
  }

  private renderActivatorOption(activator: IDeploymentMethod): JSX.Element {
    return (
      <option key={activator.id} value={activator.id}>{activator.name}</option>
    );
  }

  private selectActivator = (evt) => {
    const target: HTMLSelectElement = evt.target as HTMLSelectElement;
    this.nextState.currentActivator = target.value;
  }
}

function mapStateToProps(state: any): IConnectedProps {
  const discovery = currentGameDiscovery(state);
  const game = currentGame(state);

  const gameMode = getSafe(discovery, ['id'], getSafe(game, ['id'], undefined));

  return {
    discovery,
    game,
    gameMode,
    installPath: state.settings.mods.installPath[gameMode],
    currentActivator: getSafe(state, ['settings', 'mods', 'activator', gameMode], undefined),
    state,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetInstallPath: (gameMode: string, newPath: string): void => {
      if (newPath !== undefined) {
        dispatch(setInstallPath(gameMode, newPath));
      }
    },
    onSetActivator: (gameMode: string, id: string): void => {
      dispatch(setActivator(gameMode, id));
    },
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
    onShowError: (message: string, details: string | Error, allowReport): void => {
      showError(dispatch, message, details, { allowReport });
    },
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(Settings),
  ) as React.ComponentClass<{}>;
