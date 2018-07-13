import { showDialog } from '../../../actions/notifications';
import FlexLayout from '../../../controls/FlexLayout';
import Icon from '../../../controls/Icon';
import More from '../../../controls/More';
import Spinner from '../../../controls/Spinner';
import { Button } from '../../../controls/TooltipControls';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../../types/IDialog';
import { ComponentEx, connect, translate } from '../../../util/ComponentEx';
import { UserCanceled } from '../../../util/CustomErrors';
import * as fs from '../../../util/fs';
import { showError } from '../../../util/message';
import { getSafe } from '../../../util/storeHelper';
import { isChildPath } from '../../../util/util';
import { setDownloadPath, setMaxDownloads } from '../actions/settings';

import getDownloadPath from '../util/getDownloadPath';

import getText from '../texts';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import {} from 'opn';
import * as path from 'path';
import * as React from 'react';
import { Button as BSButton, ControlLabel, FormControl, FormGroup, HelpBlock, InputGroup,
         Jumbotron, Modal } from 'react-bootstrap';
import * as Redux from 'redux';

// tslint:disable-next-line:no-var-requires
const opn = require('opn');

interface IConnectedProps {
  parallelDownloads: number;
  isPremium: boolean;
  downloadPath: string;
}

interface IActionProps {
  onSetDownloadPath: (newPath: string) => void;
  onSetMaxDownloads: (value: number) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
  onShowError: (message: string, details: string | Error, allowReport: boolean) => void;
}

type IProps = IActionProps & IConnectedProps;

interface IComponentState {
  downloadPath: string;
  busy: string;
}

const nop = () => null;

class Settings extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);

    this.initState({
      downloadPath: props.downloadPath,
      busy: undefined,
    });
  }

  public componentWillReceiveProps(newProps: IProps) {
    if (this.props.downloadPath !== newProps.downloadPath) {
      this.nextState.downloadPath = newProps.downloadPath;
    }
  }

  public render(): JSX.Element {
    const { t, isPremium, parallelDownloads } = this.props;
    const { downloadPath } = this.state;

    const changed = this.props.downloadPath !== downloadPath;

    return (
      <form>
        <FormGroup>
          <ControlLabel>
            {t('Download Path')}
          </ControlLabel>
          <FlexLayout type='row'>
            <FlexLayout.Fixed>
              <InputGroup>
                <FormControl
                  value={downloadPath}
                  placeholder={t('Download Path')}
                  onChange={this.setDownloadPathEvt as any}
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
              <BSButton disabled={!changed} onClick={this.apply}>{t('Apply')}</BSButton>
            </FlexLayout.Fixed>
          </FlexLayout>
          <HelpBlock>{getDownloadPath(downloadPath, undefined)}</HelpBlock>
          <Modal show={this.state.busy !== undefined} onHide={nop}>
            <Modal.Body>
              <Jumbotron>
                <p><Spinner style={{ height: '32px', width: '32px' }} />
                  {this.state.busy}</p>
              </Jumbotron>
            </Modal.Body>
          </Modal>

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
                {t('Buy Premium to set multiple threads')}
              </BSButton>
            ) : null}
          </div>
        </FormGroup>
      </form>
    );
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
    const { t, onSetDownloadPath, onShowDialog, onShowError } = this.props;
    const newPath: string = getDownloadPath(this.state.downloadPath);
    const oldPath: string = getDownloadPath(this.props.downloadPath);

    let vortexPath = remote.app.getAppPath();
    if (path.basename(vortexPath) === 'app.asar') {
      // in asar builds getAppPath returns the path of the asar so need to go up 2 levels
      // (resources/app.asar)
      vortexPath = path.dirname(path.dirname(vortexPath));
    }
    if (isChildPath(newPath, vortexPath)) {
      return onShowDialog('error', 'Invalid paths selected', {
                  text: 'You can not put mods into the vortex application directory. '
                  + 'This directory gets removed during updates so you would lose all your '
                  + 'files on the next update.',
      }, [ { label: 'Close' } ]);
    }

    this.nextState.busy = t('Moving');
    return fs.ensureDirWritableAsync(newPath, this.confirmElevate)
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
          this.nextState.busy = t('Moving download directory');
          return this.transferPath();
        } else {
          return Promise.resolve();
        }
      })
      .then(() => {
        onSetDownloadPath(this.state.downloadPath);
      })
      .catch(UserCanceled, () => null)
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
    const oldPath = getDownloadPath(this.props.downloadPath);
    const newPath = getDownloadPath(this.state.downloadPath);

    return Promise.join(fs.statAsync(oldPath), fs.statAsync(newPath),
      (statOld: fs.Stats, statNew: fs.Stats) =>
        Promise.resolve(statOld.dev === statNew.dev))
      .then((sameVolume: boolean) => {
        const func = sameVolume ? fs.renameAsync : fs.copyAsync;
        return fs.readdirAsync(oldPath)
          .map((fileName: string) =>
            func(path.join(oldPath, fileName), path.join(newPath, fileName))
            .catch(err => (err.code === 'EXDEV')
                // EXDEV implies we tried to rename when source and destination are
                // not in fact on the same volume. This is what comparing the stat.dev
                // was supposed to prevent.
                ? fs.copyAsync(path.join(oldPath, fileName), path.join(newPath, fileName))
                : Promise.reject(err)))
          .then(() => fs.removeAsync(oldPath));
      })
      .catch(err => (err.code === 'ENOENT')
        ? Promise.resolve()
        : Promise.reject(err));
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

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onSetDownloadPath: (newPath: string) => dispatch(setDownloadPath(newPath)),
    onSetMaxDownloads: (value: number) => dispatch(setMaxDownloads(value)),
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
