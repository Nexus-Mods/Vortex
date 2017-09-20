import { showDialog } from '../../../actions/notifications';
import Icon from '../../../controls/Icon';
import More from '../../../controls/More';
import { Button } from '../../../controls/TooltipControls';
import { DialogActions, DialogType, IDialogContent } from '../../../types/IDialog';
import { IStatePaths } from '../../../types/IState';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { showError } from '../../../util/message';
import { activeGameId } from '../../../util/selectors';
import { getSafe, setSafe } from '../../../util/storeHelper';
import { getGame } from '../../gamemode_management';
import { currentGame, currentGameDiscovery } from '../../gamemode_management/selectors';
import { IDiscoveryResult } from '../../gamemode_management/types/IDiscoveryResult';
import { IGameStored } from '../../gamemode_management/types/IGameStored';
import { setActivator, setPath } from '../actions/settings';
import { IDeploymentMethod } from '../types/IDeploymentMethod';
import resolvePath, { pathDefaults, PathKey } from '../util/resolvePath';
import getSupportedActivators from '../util/supportedActivators';

import getText from '../texts';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as update from 'immutability-helper';
import * as _ from 'lodash';
import * as path from 'path';
import * as React from 'react';
import {
  Alert, Button as BSButton, ControlLabel, FormControl, FormGroup,
  HelpBlock, InputGroup, Jumbotron, Modal, Panel,
} from 'react-bootstrap';
import * as Redux from 'redux';

interface IBaseProps {
  activators: IDeploymentMethod[];
}

interface IConnectedProps {
  game: IGameStored;
  discovery: IDiscoveryResult;
  gameMode: string;
  paths: { [gameId: string]: IStatePaths };
  currentActivator: string;
  state: any;
}

interface IActionProps {
  onSetPath: (gameMode: string, key: string, path: string) => void;
  onSetActivator: (gameMode: string, id: string) => void;
  onShowDialog: (
    type: DialogType,
    title: string,
    content: IDialogContent,
    actions: DialogActions,
  ) => void;
  onShowError: (message: string, details: string | Error) => void;
}

interface IComponentState {
  paths: { [gameId: string]: IStatePaths };
  busy: string;
  supportedActivators: IDeploymentMethod[];
  currentActivator: string;
}

type IProps = IBaseProps & IActionProps & IConnectedProps;

const nop = () => undefined;

class Settings extends ComponentEx<IProps, IComponentState> {
  private mPathChangeCBs: { [key: string]: (evt: any) => void } = {};
  private mBrowseCBs: { [key: string]: () => void } = {};

  constructor(props) {
    super(props);
    this.state = {
      paths: { ...this.props.paths },
      busy: undefined,
      supportedActivators: [],
      currentActivator: props.currentActivator,
    };
  }

  public componentWillMount() {
    this.setState(update(this.state, {
      supportedActivators: { $set: this.supportedActivators() },
    }));
  }

  public componentDidUpdate(prevProps: IProps, prevState: IComponentState) {
    if ((this.props.gameMode !== prevProps.gameMode)
        || !_.isEqual(this.props.paths, prevProps.paths)) {
      this.setState(update(this.state, {
        supportedActivators: { $set: this.supportedActivators() },
        currentActivator: { $set: this.props.currentActivator },
      }));
    }
  }

  public render(): JSX.Element {
    const { t, activators, discovery, game, gameMode } = this.props;
    const { currentActivator, paths, supportedActivators } = this.state;

    if (game === undefined) {
      return (
        <Jumbotron>
          <div style={{ fontSize: 'x-large', margin: '0 1em' }}>
            {t('Settings on this page are game-specific ' +
              'so you have to select a game to manage first.')}
          </div>
        </Jumbotron>
      );
    }

    const gameName = getSafe(discovery, ['name'], getSafe(game, ['name'], undefined));

    const label = t('Settings for {{name}}', {
      replace: {
        name: game.name,
      },
    });

    return (
      <form>
        <FormControl.Static componentClass='h4'>{label}</FormControl.Static>
        <ControlLabel>
          {t('Paths')}
          <More id='more-paths' name={t('Paths')} >
            {getText('paths', t)}
          </More>
        </ControlLabel>
        <Panel footer={this.renderFooter()}>
          {this.renderPathCtrl(paths, t('Base Path'), 'base')}
          {this.renderPathCtrl(paths, t('Download Path'), 'download')}
          {this.renderPathCtrl(paths, t('Install Path'), 'install')}
          <Modal show={this.state.busy !== undefined} onHide={nop}>
            <Modal.Body>
              <Jumbotron>
                <p><Icon name='spinner' pulse style={{ height: '32px', width: '32px' }} />
                  {this.state.busy}</p>
              </Jumbotron>
            </Modal.Body>
          </Modal>
        </Panel>
        <ControlLabel>
          {t('Deployment Method')}
          <More id='more-deploy' name={t('Deployment')} >
            {getText('deployment', t)}
          </More>
        </ControlLabel>
        {this.renderActivators(supportedActivators, currentActivator)}
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
    const { gameMode } = this.props;
    return !_.isEqual(this.props.paths[gameMode], this.state.paths[gameMode]);
  }

  private pathsAbsolute() {
    const { gameMode } = this.props;
    return path.isAbsolute(resolvePath('download', this.state.paths, gameMode))
        && path.isAbsolute(resolvePath('install', this.state.paths, gameMode));
  }

  private transferPath(pathKey: PathKey) {
    const { gameMode } = this.props;
    const oldPath = resolvePath(pathKey, this.props.paths, gameMode);
    const newPath = resolvePath(pathKey, this.state.paths, gameMode);

    return Promise.join(fs.statAsync(oldPath), fs.statAsync(newPath),
      (statOld: fs.Stats, statNew: fs.Stats) =>
        Promise.resolve(statOld.dev === statNew.dev))
      .then((sameVolume: boolean) => sameVolume
        // in the move case we have to ensure the parent directory exists
        // and the directory itself doesn't, otherwise the move will fail
        ? fs.ensureDirAsync(path.dirname(newPath))
            .then(() => fs.removeAsync(newPath))
            .then(() => fs.renameAsync(oldPath, newPath))
        // in the copy case, just copy, then remove the original
        : fs.copyAsync(oldPath, newPath)
            .then(() => fs.removeAsync(oldPath)));
  }

  private applyPaths = () => {
    const { t, gameMode, onSetPath, onShowError } = this.props;
    const newInstallPath: string = resolvePath('install', this.state.paths, gameMode);
    const newDownloadPath: string = resolvePath('download', this.state.paths, gameMode);

    const oldInstallPath = resolvePath('install', this.props.paths, gameMode);
    const oldDownloadPath = resolvePath('download', this.props.paths, gameMode);

    const purgePromise = oldInstallPath !== newInstallPath
      ? this.purgeActivation()
      : Promise.resolve();

    this.setState(setSafe(this.state, ['busy'], t('Moving')));
    return purgePromise
      .then(() => Promise.join(fs.ensureDirAsync(newInstallPath),
                               fs.ensureDirAsync(newDownloadPath)))
      .then(() => {
        const queue = Promise.resolve();
        let fileCount = 0;
        if (oldInstallPath !== newInstallPath) {
          queue
            .then(() => fs.readdirAsync(newInstallPath))
            .then(files => fileCount += files.length);
        }
        if (oldDownloadPath !== newDownloadPath) {
          queue
            .then(() => fs.readdirAsync(newDownloadPath))
            .then(files => fileCount += files.length);
        }
        // ensure the destination directories are empty
        return new Promise((resolve, reject) => {
          if (fileCount > 0) {
            this.props.onShowDialog('info', 'Invalid Destination', {
              message: 'The destination directory has to be empty',
            }, [{ label: 'Ok', action: () => reject(null) }]);
          } else {
            resolve();
          }
        });
      })
      .then(() => {
        if (oldDownloadPath !== newDownloadPath) {
          this.setState(setSafe(this.state, ['busy'], t('Moving download directory')));
          return this.transferPath('download');
        } else {
          return Promise.resolve();
        }
      })
      .then(() => {
        if (oldInstallPath !== newInstallPath) {
          this.setState(setSafe(this.state, ['busy'], t('Moving mod directory')));
          return this.transferPath('install');
        } else {
          return Promise.resolve();
        }
      })
      .then(() => {
        onSetPath(gameMode, 'base', this.state.paths[gameMode].base);
        onSetPath(gameMode, 'download', this.state.paths[gameMode].download);
        onSetPath(gameMode, 'install', this.state.paths[gameMode].install);
      })
      .catch((err) => {
        if (err !== null) {
          onShowError('Failed to move directories', err);
        }
      })
      .finally(() => {
        this.setState(setSafe(this.state, ['busy'], undefined));
      });
  }

  private purgeActivation(): Promise<void> {
    const { activators, currentActivator, discovery, gameMode, paths } = this.props;

    const oldActivator = activators.find(iter => iter.id === currentActivator);
    const installPath = resolvePath('install', paths, gameMode);
    const game = getGame(gameMode);
    const modPaths = game.getModPaths(discovery.path);

    return oldActivator !== undefined
      ? Promise.mapSeries(Object.keys(modPaths),
                          typeId => oldActivator.purge(installPath, modPaths[typeId]))
        .then(() => undefined)
      : Promise.resolve();
  }

  private applyActivator = () => {
    const { gameMode, onSetActivator } = this.props;
    const { currentActivator } = this.state;

    this.purgeActivation().then(() => {
      onSetActivator(gameMode, currentActivator);
    });
  }

  private renderFooter() {
    const { t } = this.props;

    if (!this.pathsChanged()) {
      return null;
    }

    if (!this.pathsAbsolute()) {
      return (
        <Alert bsStyle='warning'>
          {t('Paths have to be absolute')}
        </Alert>
      );
    }

    return (
      <div className='button-group'>
        <Button
          id='btn-settings-apply'
          tooltip={t('Apply Changes. This will cause files to be moved to the new location.')}
          onClick={this.applyPaths}
        >
          {t('Apply')}
        </Button>
      </div>
    );
  }

  private renderPathCtrl(paths: any, label: string, pathKey: PathKey): JSX.Element {
    const { t, gameMode } = this.props;

    if (this.mPathChangeCBs[pathKey] === undefined) {
      this.mPathChangeCBs[pathKey] = (evt) => this.changePathEvt(pathKey, evt);
    }
    if (this.mBrowseCBs[pathKey] === undefined) {
      this.mBrowseCBs[pathKey] = () => this.browsePath(pathKey);
    }

    const gamePaths = {
      ...pathDefaults,
      ...paths[gameMode],
    };

    return (
      <FormGroup>
        <ControlLabel>{label}</ControlLabel>
        <InputGroup>
          <FormControl
            value={gamePaths[pathKey]}
            placeholder={label}
            onChange={this.mPathChangeCBs[pathKey]}
          />
          <InputGroup.Button>
            <Button
              id='move-base-path'
              tooltip={t('Browse')}
              onClick={this.mBrowseCBs[pathKey]}
            >
              <Icon name='folder-open' />
            </Button>
          </InputGroup.Button>
        </InputGroup>
        <HelpBlock>{resolvePath(pathKey, paths, gameMode)}</HelpBlock>
      </FormGroup>
    );
  }

  private changePathEvt = (key: string, evt) => {
    const target: HTMLInputElement = evt.target as HTMLInputElement;
    this.changePath(key, target.value);
  }

  private changePath = (key: string, value: string) => {
    const { gameMode } = this.props;
    this.setState(setSafe(this.state, ['paths', gameMode, key], value));
  }

  private browsePath = (key: string) => {
    this.context.api.selectDir({})
      .then((selectedPath: string) => {
        if (selectedPath) {
          this.changePath(key, selectedPath);
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
            {activators[activatorIdx].description}
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
    this.setState(setSafe(this.state, ['currentActivator'], target.value));
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
    paths: state.settings.mods.paths,
    currentActivator: getSafe(state, ['settings', 'mods', 'activator', gameMode], undefined),
    state,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetPath: (gameMode: string, key: string, newPath: string): void => {
      if (newPath !== undefined) {
        dispatch(setPath(gameMode, key, newPath));
      }
    },
    onSetActivator: (gameMode: string, id: string): void => {
      dispatch(setActivator(gameMode, id));
    },
    onShowDialog: (type, title, content, actions): void => {
      dispatch(showDialog(type, title, content, actions));
    },
    onShowError: (message: string, details: string | Error): void => {
      showError(dispatch, message, details);
    },
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(Settings),
  ) as React.ComponentClass<{}>;
