import { showDialog } from '../../../actions/notifications';
import FlexLayout from '../../../controls/FlexLayout';
import Icon from '../../../controls/Icon';
import More from '../../../controls/More';
import Spinner from '../../../controls/Spinner';
import { Button } from '../../../controls/TooltipControls';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../../types/IDialog';
import { IDownload, IState } from '../../../types/IState';
import { ValidationState } from '../../../types/ITableAttribute';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { CleanupFailedException, InsufficientDiskSpace, NotFound, UnsupportedOperatingSystem,
         UserCanceled } from '../../../util/CustomErrors';
import { withContext } from '../../../util/errorHandling';
import * as fs from '../../../util/fs';
import { log } from '../../../util/log';
import { showError } from '../../../util/message';
import opn from '../../../util/opn';
import { getSafe } from '../../../util/storeHelper';
import { testPathTransfer, transferPath } from '../../../util/transferPath';
import { isChildPath, isPathValid } from '../../../util/util';
import { setDownloadPath, setMaxDownloads } from '../actions/settings';
import { setTransferDownloads } from '../actions/transactions';
import { getVortexPath } from '../../../util/api';

import getDownloadPath, {getDownloadPathPattern} from '../util/getDownloadPath';
import writeDownloadsTag from '../util/writeDownloadsTag';

import getTextMod from '../../mod_management/texts';
import getText from '../texts';

import Promise from 'bluebird';
import * as path from 'path';
import * as process from 'process';
import * as React from 'react';
import { Button as BSButton, ControlLabel, FormControl, FormGroup, HelpBlock, InputGroup,
         Jumbotron, Modal, ProgressBar } from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

const NEXUS_MEMBERSHIP_URL = 'https://users.nexusmods.com/register/memberships';

interface IConnectedProps {
  parallelDownloads: number;
  isPremium: boolean;
  downloadPath: string;
  downloads: { [downloadId: string]: IDownload };
}

interface IActionProps {
  onSetDownloadPath: (newPath: string) => void;
  onSetTransfer: (dest: string) => void;
  onSetMaxDownloads: (value: number) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
  onShowError: (message: string, details: string | Error,
                allowReport: boolean, isBBCode?: boolean) => void;
}

type IProps = IActionProps & IConnectedProps;

interface IComponentState {
  downloadPath: string;
  busy: string;
  progress: number;
  progressFile: string;
}

const nop = () => null;

class Settings extends ComponentEx<IProps, IComponentState> {
  private mLastFileUpdate: number = 0;
  constructor(props: IProps) {
    super(props);

    this.initState({
      downloadPath: props.downloadPath,
      busy: undefined,
      progress: 0,
      progressFile: undefined,
    });
  }

  public UNSAFE_componentWillReceiveProps(newProps: IProps) {
    if (this.props.downloadPath !== newProps.downloadPath) {
      this.nextState.downloadPath = newProps.downloadPath;
    }
  }

  public render(): JSX.Element {
    const { t, downloads, isPremium, parallelDownloads } = this.props;
    const { downloadPath, progress, progressFile } = this.state;

    const changed = this.props.downloadPath !== downloadPath;
    const pathPreview = getDownloadPath(downloadPath, undefined);
    const validationState = this.validateDownloadPath(pathPreview);

    const pathValid = validationState.state !== 'error';

    const hasActivity = Object.keys(downloads)
      .find(dlId => downloads[dlId].state === 'started') !== undefined;

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
                    disabled={!changed || (validationState.state === 'error') || hasActivity}
                    onClick={this.apply}
                  >
                    {hasActivity ? <Spinner /> : t('Apply')}
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
                  <div className='container'>
                    <h2>{this.state.busy}</h2>
                    {(progressFile !== undefined) ? (<p>{progressFile}</p>) : null}
                    <ProgressBar style={{ height: '1.5em' }} now={progress} max={100} />
                  </div>
                </Jumbotron>
              </Modal.Body>
            </Modal>
          </div>
        </FormGroup>
        <FormGroup>
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

  private isPathSensible(input: string): boolean {
    const sanitizeSep = new RegExp('/', 'g');
    const trimTrailingSep = new RegExp(`\\${path.sep}*$`, 'g');
    if (process.platform === 'win32') {
      // Ensure the user isn't trying to set the partition's root path
      //  as the staging folder.
      input = input.replace(sanitizeSep, path.sep).replace(trimTrailingSep, '');
      const splitInp = input.split(path.sep);
      return splitInp.length > 1
        ? true
          : ((splitInp[0].length === 2) && (splitInp[0][1] === ':'))
            ? false
            : true;
    } else {
      // Currently not imposing any restrictions on non-windows platforms.
      return true;
    }
  }

  private validateDownloadPath(input: string): { state: ValidationState, reason?: string } {
    let vortexPath = getVortexPath('base');
    if (path.basename(vortexPath) === 'app.asar') {
      // in asar builds, returns the path of the asar so need to go up 2 levels
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

    if (!isPathValid(input)) {
      return {
        state: 'error',
        reason: 'Path cannot contain illegal characters or reserved names',
      };
    }

    if (!this.isPathSensible(input)) {
      return {
        state: 'error',
        reason: 'Path cannot be the root of a partition',
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
    opn(NEXUS_MEMBERSHIP_URL).catch(err => undefined);
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

    let vortexPath = getVortexPath('base');
    if (path.basename(vortexPath) === 'app.asar') {
      // in asar builds, returns the path of the asar so need to go up 2 levels
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

    let deleteOldDestination = true;
    this.nextState.progress = 0;
    this.nextState.busy = t('Moving');
    return withContext('Transferring Downloads', `from ${oldPath} to ${newPath}`,
      () => testPathTransfer(oldPath, newPath)
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
              text: 'The destination folder has to be empty',
            }, [{ label: 'Ok', action: () => reject(null), default: true }]);
          } else {
            resolve();
          }
        }));
      })
      .then(() => {
        if (oldPath !== newPath) {
          this.nextState.busy = t('Moving download folder');
          return this.transferPath()
            .then(() => writeDownloadsTag(this.context.api, newPath));
        } else {
          return Promise.resolve();
        }
      })
      .then(() => {
        onSetTransfer(undefined);
        onSetDownloadPath(this.state.downloadPath);
        this.context.api.events.emit('did-move-downloads');
      })
      .catch(UserCanceled, () => null)
      .catch(CleanupFailedException, err => {
        deleteOldDestination = false;
        onSetTransfer(undefined);
        onSetDownloadPath(this.state.downloadPath);
        this.context.api.events.emit('did-move-downloads');
        onShowDialog('info', 'Cleanup failed', {
          bbcode: t('The downloads folder has been copied [b]successfully[/b] to '
            + 'your chosen destination!<br />'
            + 'Clean-up of the old downloads folder has been cancelled.<br /><br />'
            + `Old downloads folder: [url]{{thePath}}[/url]`,
            { replace: { thePath: oldPath } }),
        }, [ { label: 'Close', action: () => Promise.resolve() } ]);

        if (!(err.errorObject instanceof UserCanceled)) {
          this.context.api.showErrorNotification('Clean-up failed', err.errorObject);
        }
      })
      .catch(InsufficientDiskSpace, () => notEnoughDiskSpace())
      .catch(UnsupportedOperatingSystem, () =>
        onShowError('Unsupported operating system',
        'This functionality is currently unavailable for your operating system!',
        false))
      .catch(NotFound, () =>
        onShowError('Invalid destination',
        'The destination partition you selected is invalid - please choose a different '
      + 'destination', false))
      .catch((err) => {
        if (err !== null) {
          if (err.code === 'EPERM') {
            onShowError('Directories are locked', err, false);
          } else if (err.code === 'EINVAL') {
            onShowError(
              'Invalid path', err.message, false);
          } else if (err.code === 'EIO') {
            // Input/Output file operations have been interrupted.
            //  this is not a bug in Vortex but rather a hardware/networking
            //  issue (depending on the user's setup).
            onShowError('File operations interrupted',
              'Input/Output file operations have been interrupted. This is not a bug in Vortex, '
            + 'but rather a problem with your environment!<br /><br />'
            + 'Possible reasons behind this issue:<br />'
            + '1. Your HDD/Removable drive has become unseated during transfer.<br />'
            + '2. File operations were running on a network drive and said drive has become '
            + 'disconnected for some reason (Network hiccup?)<br />'
            + '3. An overzealous third party tool (possibly Anti-Virus or virus) '
            + 'which is blocking Vortex from completing its operations.<br />'
            + '4. A faulty HDD/Removable drive.<br /><br />'
            + 'Please test your environment and try again once you\'ve confirmed it\'s fixed.',
            false, true);
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
        const pendingTransfer: string[] = ['persistent', 'transactions', 'transfer', 'downloads'];
        if ((getSafe(state, pendingTransfer, undefined) !== undefined)
          && deleteOldDestination) {
          return fs.removeAsync(newPath)
            .then(() => {
              onSetTransfer(undefined);
              this.nextState.busy = undefined;
            })
            .catch(UserCanceled, () => {
              this.nextState.busy = undefined;
            })
            .catch(err => {
              this.nextState.busy = undefined;
              if (err.code === 'ENOENT') {
                // Folder is already gone, that's fine.
                onSetTransfer(undefined);
              } else if (err.code === 'EPERM') {
                onShowError('Destination folder is not writable', 'Vortex is unable to clean up '
                          + 'the destination folder due to a permissions issue.', false);
              } else {
                onShowError('Transfer clean-up failed', err, true);
              }
            });
        } else {
          this.nextState.busy = undefined;
        }
      }));
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
    const { t, onSetTransfer, onShowDialog } = this.props;
    const oldPath = getDownloadPath(this.props.downloadPath);
    const newPath = getDownloadPath(this.state.downloadPath);

    this.context.api.events.emit('will-move-downloads');
    let sourceIsMissing = false;
    return fs.statAsync(oldPath)
      .catch(err => {
        // The initial downloads folder is missing! this may be a valid case if:
        //  1. HDD or removable media is faulty or has become unseated and is
        //  no longer detectable by the OS.
        //  2. Source folder was located on a network drive which is no longer available.
        //  3. User has changed drive letter for whatever reason.
        //
        //  Currently we have confirmed that the error code will be set to "UNKNOWN"
        //  for all these cases, but we may have to add other error codes if different
        //  error cases pop up.
        sourceIsMissing = (['ENOENT', 'UNKNOWN'].indexOf(err.code) !== -1);
        log('warn', 'Transfer failed - missing source directory', err);
        return (sourceIsMissing)
          ? Promise.resolve(undefined)
          : Promise.reject(err);
      })
      .then(stats => {
        const queryReset = (stats !== undefined)
          ? Promise.resolve()
          : onShowDialog('question', 'Missing downloads folder', {
            bbcode: 'Vortex is unable to find your current downloads folder; '
              + 'this can happen when: <br />'
              + '1. You or an external application removed this folder.<br />'
              + '2. Your HDD/removable drive became faulty or unseated.<br />'
              + '3. The downloads folder was located on a network drive which has been '
              + 'disconnected for some reason.<br /><br />'
              + 'Please diagnose your system and ensure that the downloads folder is detectable '
              + 'by your operating system.<br /><br />'
              + 'Alternatively, if you want to force Vortex to "re-initialize" your downloads '
              + 'folder at the destination you have chosen, Vortex can do this for you but '
              + 'note that the folder will be empty as nothing will be transferred inside it!',
          },
            [
              { label: 'Cancel' },
              { label: 'Reinitialize' },
            ])
            .then(result => (result.action === 'Cancel')
              ? Promise.reject(new UserCanceled())
              : Promise.resolve());

        return queryReset
          .then(() => {
            onSetTransfer(newPath);
            return transferPath(oldPath, newPath, (from: string, to: string, progress: number) => {
              log('debug', 'transfer downloads', { from, to });
              if (progress > this.state.progress) {
                this.nextState.progress = progress;
              }
              if ((this.state.progressFile !== from)
                && ((Date.now() - this.mLastFileUpdate) > 1000)) {
                this.nextState.progressFile = path.basename(from);
              }
            })
              .catch(err => (sourceIsMissing && (err.path === oldPath))
                ? Promise.resolve()
                : Promise.reject(err));
          });
      });
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  return {
    parallelDownloads: state.settings.downloads.maxParallelDownloads,
    // TODO: this breaks encapsulation
    isPremium: getSafe(state, ['persistent', 'nexus', 'userInfo', 'isPremium'], false),
    downloadPath: state.settings.downloads.path,
    downloads: state.persistent.downloads.files,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetDownloadPath: (newPath: string) => dispatch(setDownloadPath(newPath)),
    onSetMaxDownloads: (value: number) => dispatch(setMaxDownloads(value)),
    onSetTransfer: (dest: string) => dispatch(setTransferDownloads(dest)),
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
    onShowError: (message: string, details: string | Error,
                  allowReport: boolean, isBBCode?: boolean): void =>
      showError(dispatch, message, details, { allowReport, isBBCode }),
  };
}

export default
  translate(['common'])(
    connect(mapStateToProps, mapDispatchToProps)(
      Settings)) as React.ComponentClass<{}>;
