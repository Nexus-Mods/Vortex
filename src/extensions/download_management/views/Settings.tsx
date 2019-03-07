import { showDialog } from '../../../actions/notifications';
import FlexLayout from '../../../controls/FlexLayout';
import Icon from '../../../controls/Icon';
import More from '../../../controls/More';
import { Button } from '../../../controls/TooltipControls';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../../types/IDialog';
import { ValidationState } from '../../../types/ITableAttribute';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { InsufficientDiskSpace, UnsupportedOperatingSystem,
         UserCanceled } from '../../../util/CustomErrors';
import * as fs from '../../../util/fs';
import { log } from '../../../util/log';
import { showError } from '../../../util/message';
import opn from '../../../util/opn';
import { getSafe } from '../../../util/storeHelper';
import { testPathTransfer, transferPath } from '../../../util/transferPath';
import { isChildPath } from '../../../util/util';
import { setDownloadPath, setMaxDownloads } from '../actions/settings';
import { setTransferDownloads } from '../actions/transfer';

import getDownloadPath, {getDownloadPathPattern} from '../util/getDownloadPath';

import getTextMod from '../../mod_management/texts';
import getText from '../texts';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as path from 'path';
import * as process from 'process';
import * as React from 'react';
import { Button as BSButton, ControlLabel, FormControl, FormGroup, HelpBlock, InputGroup,
         Jumbotron, Modal, ProgressBar } from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

interface IConnectedProps {
  parallelDownloads: number;
  isPremium: boolean;
  downloadPath: string;
}

interface IActionProps {
  onSetDownloadPath: (newPath: string) => void;
  onSetTransfer: (dest: string) => void;
  onSetMaxDownloads: (value: number) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
  onShowError: (message: string, details: string | Error, allowReport: boolean) => void;
}

type IProps = IActionProps & IConnectedProps;

interface IComponentState {
  downloadPath: string;
  busy: string;
  progress: number;
  currentPlatform: string;
}

const nop = () => null;
/* tslint:disable:no-namespace no-internal-module whitespace */
class Settings extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);

    this.initState({
      downloadPath: props.downloadPath,
      busy: undefined,
      progress: 0,
      currentPlatform: '',
    });
  }

  public componentWillMount() {
    this.nextState.currentPlatform = process.platform;
  }

  public componentWillReceiveProps(newProps: IProps) {
    if (this.props.downloadPath !== newProps.downloadPath) {
      this.nextState.downloadPath = newProps.downloadPath;
    }
  }

  public render(): JSX.Element {
    const { t, isPremium, parallelDownloads } = this.props;
    const { downloadPath, progress } = this.state;

    const changed = this.props.downloadPath !== downloadPath;
    const pathPreview = getDownloadPath(downloadPath, undefined);
    const validationState = this.validateDownloadPath(pathPreview);

    const pathValid = validationState.state !== 'error';

    return (
      // Supressing default form submission event.
      <form onSubmit={this.submitEvt}>
        <FormGroup validationState={validationState.state}>
          <div id='download-path-form'>
            <ControlLabel>
              {t('Download Folder')}
              <More id='more-paths' name={t('Paths')} >
                {getTextMod('paths', t)}
              </More>
            </ControlLabel>
            <FlexLayout type='row'>
              <FlexLayout.Fixed>
                <InputGroup>
                  <FormControl
                    className='download-path-input'
                    value={getDownloadPathPattern(downloadPath)}
                    placeholder={t('Download Folder')}
                    onChange={this.setDownloadPathEvt as any}
                    onKeyPress={changed && pathValid ? this.keyPressEvt : null}
                  />
                  <InputGroup.Button className='inset-btn'>
                    <Button
                      tooltip={t('Browse')}
                      onClick={this.browseDownloadPath}
                    >
                      <Icon name='browse' />
                    </Button>
                  </InputGroup.Button>
                </InputGroup>
              </FlexLayout.Fixed>
              <FlexLayout.Fixed>
                <InputGroup.Button>
                  <BSButton
                    disabled={!changed || (validationState.state === 'error')}
                    onClick={this.apply}
                  >
                    {t('Apply')}
                  </BSButton>
                </InputGroup.Button>
              </FlexLayout.Fixed>
            </FlexLayout>
            <HelpBlock>
              <a data-url={pathPreview} onClick={this.openUrl}>{pathPreview}</a>
            </HelpBlock>
            {validationState.reason ? (
              <ControlLabel>{t(validationState.reason)}</ControlLabel>
             ) : null}
            <Modal show={this.state.busy !== undefined} onHide={nop}>
              <Modal.Body>
                <Jumbotron>
                  <p>{this.state.busy}</p>
                  <ProgressBar style={{ height: '1.5em' }} now={progress} max={100}/>
                </Jumbotron>
              </Modal.Body>
            </Modal>
          </div>

          <ControlLabel>
            {t('Download Threads') + ': ' + parallelDownloads.toString()}
            <More id='more-download-threads' name={t('Download Threads')} >
              {getText('download-threads', t)}
            </More>
          </ControlLabel>
          <div style={{ display: 'flex' }}>
            <FormControl
              type='range'
              value={parallelDownloads}
              min={1}
              max={10}
              onChange={this.onChangeParallelDownloads}
              disabled={!isPremium}
            />
            {!isPremium ? (
              <BSButton
                onClick={this.goBuyPremium}
                className='btn-download-go-premium'
              >
                {t('Go Premium')}
              </BSButton>
            ) : null}
          </div>
          <div>
            {!isPremium ? (
              <p>
                {t('Regular users are restricted to 1 download thread - '
                 + 'Go Premium for up to 10 download threads!')}
              </p>
              ) : null
            }
          </div>
        </FormGroup>
      </form>
    );
  }

  private validateDownloadPath(input: string): { state: ValidationState, reason?: string } {
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
        reason: 'Download folder can\'t be a subdirectory of the Vortex application folder.',
      };
    }

    if (input.length > 100) {
      return {
        state: (input.length > 200) ? 'error' : 'warning',
        reason: 'Download path shouldn\'t be too long, otherwise downloads may fail.',
      };
    }

    if (!path.isAbsolute(input)) {
      return {
        state: 'error',
        reason: 'Download folder needs to be an absolute path.',
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

  private submitEvt = (evt) => {
    evt.preventDefault();
  }

  private keyPressEvt = (evt) => {
    if (evt.which === 13) {
      evt.preventDefault();
      this.apply();
    }
  }

  private openUrl = (evt) => {
    const url = evt.currentTarget.getAttribute('data-url');
    opn(url).catch(err => undefined);
  }

  private goBuyPremium = () => {
    opn('https://www.nexusmods.com/register/premium').catch(err => undefined);
  }

  private setDownloadPath = (newPath: string) => {
    this.nextState.downloadPath = newPath;
  }

  private setDownloadPathEvt = (evt) => {
    this.setDownloadPath(evt.currentTarget.value);
  }

  private browseDownloadPath = () => {
    this.context.api.selectDir({})
      .then((selectedPath: string) => {
        if (selectedPath) {
          this.setDownloadPath(selectedPath);
        }
      });
  }

  private onChangeParallelDownloads = (evt) => {
    const { onSetMaxDownloads } = this.props;
    onSetMaxDownloads(evt.currentTarget.value);
  }

  private apply = () => {
    const { t, onSetDownloadPath, onShowDialog, onShowError, onSetTransfer } = this.props;
    const newPath: string = getDownloadPath(this.state.downloadPath);
    const oldPath: string = getDownloadPath(this.props.downloadPath);

    let vortexPath = remote.app.getAppPath();
    if (path.basename(vortexPath) === 'app.asar') {
      // in asar builds getAppPath returns the path of the asar so need to go up 2 levels
      // (resources/app.asar)
      vortexPath = path.dirname(path.dirname(vortexPath));
    }

    if (!path.isAbsolute(newPath)
        || isChildPath(newPath, vortexPath)) {
      return onShowDialog('error', 'Invalid paths selected', {
                  text: 'You can not put mods into the vortex application directory. '
                  + 'This directory gets removed during updates so you would lose all your '
                  + 'files on the next update.',
      }, [ { label: 'Close' } ]);
    }

    if (isChildPath(oldPath, newPath)) {
      return onShowDialog('error', 'Invalid path selected', {
                text: 'You can\'t change the download folder to be the parent of the old folder. '
                    + 'This is because the new download folder has to be empty and it isn\'t '
                    + 'empty if it contains the old download folder.',
      }, [ { label: 'Close' } ]);
    }

    const notEnoughDiskSpace = () => {
      return onShowDialog('error', 'Insufficient disk space', {
        text: 'You do not have enough disk space to move the downloads folder to your '
            + 'proposed destination folder.\n\n'
            + 'Please select a different destination or free up some space and try again!',
      }, [ { label: 'Close' } ]);
    };

    this.nextState.progress = 0;
    this.nextState.busy = t('Moving');
    return testPathTransfer(oldPath, newPath)
      .then(() => fs.ensureDirWritableAsync(newPath, this.confirmElevate))
      .then(() => {
        let queue = Promise.resolve();
        let fileCount = 0;
        if (oldPath !== newPath) {
          queue = queue
            .then(() => fs.readdirAsync(newPath))
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
        if (oldPath !== newPath) {
          this.nextState.busy = t('Moving download folder');
          return this.transferPath();
        } else {
          return Promise.resolve();
        }
      })
      .then(() => {
        onSetTransfer(undefined);
        onSetDownloadPath(this.state.downloadPath);
        this.context.api.events.emit('did-move-downloads');
      })
      .catch(InsufficientDiskSpace, () => notEnoughDiskSpace())
      .catch(UnsupportedOperatingSystem, () =>
        onShowError('Unsupported operating system',
        'This functionality is currently unavailable for your operating system!',
        false))
      .catch((err) => {
        if (err !== null) {
          if (err.code === 'EPERM') {
            onShowError('Directories are locked', err, false);
          } else if (err.code === 'EINVAL') {
            onShowError(
              'Invalid path', err.message, false);
          } else {
            onShowError('Failed to move directories', err, true);
          }
        }
      })
      .finally(() => {
        const state = this.context.api.store.getState();
        // Any transfers would've completed at this point.
        //  Check if we still have the transfer state populated,
        //  if it is - that means that the user has cancelled the transfer,
        //  we need to cleanup.
        if (getSafe(state, ['settings', 'transfer', 'downloads'], undefined) !== undefined) {
          fs.removeAsync(newPath)
            .then(() => onSetTransfer(undefined))
            .catch(err => {
              if (err.code === 'ENOENT') {
                // Folder is already gone, that's fine.
                onSetTransfer(undefined)
              } else if (err.code === 'EPERM') {
                onShowError('Destination folder is not writable', 'Vortex is unable to clean up '
                          + 'the destination folder due to a permissions issue.', false);
              } else {
                onShowError('Transfer clean-up failed', err, false);
              }
            });
        }

        this.nextState.busy = undefined;
      });
  }

  private confirmElevate = (): Promise<void> => {
    const { t, onShowDialog } = this.props;
    return onShowDialog('question', 'Access denied', {
      text: 'This directory is not writable to the current windows user account. '
          + 'Vortex can try to create the directory as administrator but it will '
          + 'then have to give access to it to all logged in users.',
    }, [
      { label: 'Cancel' },
      { label: 'Create as Administrator' },
    ])
    .then(result => (result.action === 'Cancel')
      ? Promise.reject(new UserCanceled())
      : Promise.resolve());
  }

  private transferPath() {
    const { onSetTransfer } = this.props;
    const oldPath = getDownloadPath(this.props.downloadPath);
    const newPath = getDownloadPath(this.state.downloadPath);

    this.context.api.events.emit('will-move-downloads');

    onSetTransfer(newPath);
    return transferPath(oldPath, newPath, (from: string, to: string, progress: number) => {
      log('debug', 'transfer download', { from, to });
      if (progress > this.state.progress) {
        this.nextState.progress = progress;
      }
    });
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    parallelDownloads: state.settings.downloads.maxParallelDownloads,
    // TODO: this breaks encapsulation
    isPremium: getSafe(state, ['persistent', 'nexus', 'userInfo', 'isPremium'], false),
    downloadPath: state.settings.downloads.path,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetDownloadPath: (newPath: string) => dispatch(setDownloadPath(newPath)),
    onSetMaxDownloads: (value: number) => dispatch(setMaxDownloads(value)),
    onSetTransfer: (dest: string) => dispatch(setTransferDownloads(dest)),
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
    onShowError: (message: string, details: string | Error, allowReport): void =>
      showError(dispatch, message, details, { allowReport }),
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      Settings)) as React.ComponentClass<{}>;
