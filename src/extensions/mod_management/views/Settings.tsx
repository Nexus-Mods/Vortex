import { showDialog } from '../../../actions/notifications';
import EmptyPlaceholder from '../../../controls/EmptyPlaceholder';
import FlexLayout from '../../../controls/FlexLayout';
import Icon from '../../../controls/Icon';
import More from '../../../controls/More';
import Spinner from '../../../controls/Spinner';
import { Button } from '../../../controls/TooltipControls';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../../types/IDialog';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { TemporaryError, UserCanceled } from '../../../util/CustomErrors';
import * as fs from '../../../util/fs';
import { log } from '../../../util/log';
import opn from '../../../util/opn';
import { showError } from '../../../util/message';
import { getSafe } from '../../../util/storeHelper';
import { isChildPath } from '../../../util/util';
import { getGame } from '../../gamemode_management';
import { currentGame, currentGameDiscovery } from '../../gamemode_management/selectors';
import { IDiscoveryResult } from '../../gamemode_management/types/IDiscoveryResult';
import { IGameStored } from '../../gamemode_management/types/IGameStored';
import { setActivator, setInstallPath } from '../actions/settings';
import { IDeploymentMethod } from '../types/IDeploymentMethod';
import getInstallPath, { getInstallPathPattern } from '../util/getInstallPath';
import getSupportedActivators from '../util/supportedActivators';
import { setDeploymentNecessary } from '../actions/deployment';

import getText from '../texts';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as path from 'path';
import * as React from 'react';
import {
  Alert, Button as BSButton, ControlLabel, FormControl, FormGroup,
  HelpBlock, InputGroup, Jumbotron, Modal, Panel, ProgressBar,
} from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

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
    });
  }

  public componentWillMount() {
    this.nextState.supportedActivators = this.supportedActivators();
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
      <form>
        <Panel>
          <PanelX.Body>
            {this.renderPathCtrl(t('Install Path ({{name}})', { replace: { name: gameName } }))}
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

  /**
   * return only those activators that are supported based on the current state
   *
   * @param {*} state
   * @returns {IDeploymentMethod[]}
   */
  private supportedActivators(): IDeploymentMethod[] {
    return getSupportedActivators(this.props.activators, this.props.state);
  }

  private pathsChanged() {
    return this.props.installPath !== this.state.installPath;
  }

  private transferPath() {
    const { gameMode } = this.props;
    const oldPath = getInstallPath(this.props.installPath, gameMode);
    const newPath = getInstallPath(this.state.installPath, gameMode);

    return Promise.join(fs.statAsync(oldPath), fs.statAsync(newPath),
      (statOld: fs.Stats, statNew: fs.Stats) =>
        Promise.resolve(statOld.dev === statNew.dev))
      .then((sameVolume: boolean) => {
        const func = sameVolume ? fs.renameAsync : fs.copyAsync;

        let completed = 0;
        let lastProgress = 0;
        let count: number;

        return fs.readdirAsync(oldPath)
          .map((fileName: string, index: number, numFiles: number) => {
            if (count === undefined) {
              count = numFiles;
            }
            log('debug', 'transfer installs', { fileName });
            return func(path.join(oldPath, fileName), path.join(newPath, fileName))
              .catch(err => (err.code === 'EXDEV')
                // EXDEV implies we tried to rename when source and destination are
                // not in fact on the same volume. This is what comparing the stat.dev
                // was supposed to prevent.
                ? fs.copyAsync(path.join(oldPath, fileName), path.join(newPath, fileName))
                : Promise.reject(err))
              .then(() => {
                ++completed;
                const progress = Math.floor((completed * 100) / count);
                if (progress > lastProgress) {
                  this.nextState.progress = progress;
                }
              });
            })
            .then(() => fs.removeAsync(oldPath));
      })
      .catch(err => (err.code === 'ENOENT')
        ? Promise.resolve()
        : Promise.reject(err));
  }

  private applyPaths = () => {
    const { t, gameMode, onSetInstallPath, onShowDialog, onShowError } = this.props;
    const newInstallPath: string = getInstallPath(this.state.installPath, gameMode);
    const oldInstallPath: string = getInstallPath(this.props.installPath, gameMode);

    let vortexPath = remote.app.getAppPath();
    if (path.basename(vortexPath) === 'app.asar') {
      // in asar builds getAppPath returns the path of the asar so need to go up 2 levels
      // (resources/app.asar)
      vortexPath = path.dirname(path.dirname(vortexPath));
    }
    if (isChildPath(newInstallPath, vortexPath)) {
      return onShowDialog('error', 'Invalid paths selected', {
                  text: 'You can not put mods into the vortex application directory. '
                  + 'This directory gets removed during updates so you would lose all your '
                  + 'files on the next update.',
      }, [ { label: 'Close' } ]);
    }

    const purgePromise = oldInstallPath !== newInstallPath
      ? this.purgeActivation()
      : Promise.resolve();

    this.nextState.busy = t('Moving');
    return purgePromise
      .then(() => fs.ensureDirAsync(newInstallPath))
      .then(() => {
        let queue = Promise.resolve();
        let fileCount = 0;
        if (oldInstallPath !== newInstallPath) {
          queue = queue
            .then(() => fs.readdirAsync(newInstallPath))
            .then(files => { fileCount += files.length; });
        }
        // ensure the destination directories are empty
        return queue.then(() => new Promise((resolve, reject) => {
          if (fileCount > 0) {
            this.props.onShowDialog('info', 'Invalid Destination', {
              message: 'The destination directory has to be empty',
            }, [{ label: 'Ok', action: () => reject(null) }]);
          } else {
            resolve();
          }
        }));
      })
      .then(() => {
        if (oldInstallPath !== newInstallPath) {
          this.nextState.busy = t('Moving mod directory');
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
    const { activators, currentActivator, discovery, gameMode,
            installPath } = this.props;

    const oldActivator = activators.find(iter => iter.id === currentActivator);
    const resolvedPath = getInstallPath(installPath, gameMode);
    const game = getGame(gameMode);
    const modPaths = game.getModPaths(discovery.path);

    return oldActivator !== undefined
      ? Promise.mapSeries(Object.keys(modPaths),
                          typeId => oldActivator.purge(resolvedPath, modPaths[typeId]))
        .then(() => undefined)
      : Promise.resolve();
  }

  private applyActivator = () => {
    const { gameMode, onSetActivator, onShowError } = this.props;
    const { currentActivator } = this.state;

    this.purgeActivation()
    .then(() => { this.context.api.events.emit('purge-mods', (err) => null); })
    .then(() => { onSetActivator(gameMode, currentActivator); })
    .then(() => { this.context.api.store.dispatch(setDeploymentNecessary(gameMode, true)); })
    .catch(TemporaryError, err => {
      onShowError('Failed to purge previous deployment, please try again',
                  err, false);
    })
    .catch(err => {
      onShowError('Failed to purge previous deployment', err, true);
    });
  }

  private renderPathCtrl(label: string): JSX.Element {
    const { t, gameMode } = this.props;
    const { installPath } = this.state;

    const pathPreview = getInstallPath(installPath, gameMode);

    return (
      <FormGroup>
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
              <BSButton
                disabled={!this.pathsChanged()}
                onClick={this.applyPaths}
              >
                {t('Apply')}
              </BSButton>
            </InputGroup.Button>
          </FlexLayout.Fixed>
        </FlexLayout>
        <HelpBlock><a data-url={pathPreview} onClick={this.openUrl}>{pathPreview}</a></HelpBlock>
      </FormGroup>
    );
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
            {t('No deployment method available')}
          </Alert>
        </ControlLabel>
      );
    }

    return (
      <FormGroup validationState={activators !== undefined ? undefined : 'error'}>
        <InputGroup>
          {content}
          <InputGroup.Button>
            <BSButton disabled={!changed} onClick={this.applyActivator}>{t('Apply')}</BSButton>
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
