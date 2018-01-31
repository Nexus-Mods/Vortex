import { addFeedbackFile, clearFeedbackFiles, removeFeedbackFile } from '../actions/session';
import { IFeedbackFile } from '../types/IFeedbackFile';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as update from 'immutability-helper';
import * as os from 'os';
import * as path from 'path';
import * as React from 'react';
import { Col, ControlLabel, DropdownButton, FormGroup, Grid,
  ListGroup, ListGroupItem, MenuItem, Panel, Row,
} from 'react-bootstrap';
import { Trans, translate } from 'react-i18next';
import { connect } from 'react-redux';
import * as Redux from 'redux';
import {} from 'redux-thunk';
import { dir as tmpDir, file as tmpFile } from 'tmp';
import {
  actions, ComponentEx, Dropzone, FlexLayout, fs, Icon, IconBar, ITableRowAction,
  log, MainPage, Table, Toggle, tooltip, types, util,
} from 'vortex-api';

type ControlMode = 'urls' | 'files';

interface IConnectedProps {
  feedbackMessage: string;
  feedbackFiles: { [fileId: string]: IFeedbackFile };
  APIKey: string;
}

interface IActionProps {
  onShowActivity: (message: string, id?: string) => void;
  onDismissNotification: (id: string) => void;
  onRemoveFeedbackFile: (feedbackFileId: string) => void;
  onShowDialog: (type: types.DialogType, title: string, content: types.IDialogContent,
                 actions: types.DialogActions) => void;
  onShowError: (message: string, details?: string | Error,
                notificationId?: string, allowReport?: boolean) => void;
  onClearFeedbackFiles: () => void;
  onAddFeedbackFile: (feedbackFile: IFeedbackFile) => void;
}

type IProps = IConnectedProps & IActionProps;

interface IComponentState {
  feedbackMessage: string;
  anonymous: boolean;
  sending: boolean;
}

const SAMPLE_REPORT = 'E.g.:\n' +
  'Summary: The mod downloads properly but when I try to install it nothing happens.\n' +
  'Expected Results: The mod is installed.\n' +
  'Actual Results: Nothing happens.\n' +
  'Steps to reproduce: Download a mod, then click Install inside the Actions menu.';

class FeedbackPage extends ComponentEx<IProps, IComponentState> {
  private feedbackActions: ITableRowAction[];

  constructor(props: IProps) {
    super(props);

    this.initState({
      feedbackMessage: props.feedbackMessage,
      anonymous: false,
      sending: false,
    });

    this.feedbackActions = [
      {
        icon: 'delete',
        title: this.props.t('Delete'),
        action: this.remove,
      },
    ];
  }

  public componentWillReceiveProps(newProps: IProps) {
    if (this.props.feedbackMessage !== newProps.feedbackMessage) {
      this.nextState.feedbackMessage = newProps.feedbackMessage;
    }
  }

  public render(): JSX.Element {
    const { feedbackFiles, t } = this.props;

    const T: any = Trans;
    const PanelX: any = Panel;
    return (
      <MainPage>
        <FlexLayout type='column'>
          <FlexLayout.Fixed>
            <h2>{t('Provide Feedback')}</h2>
            <h4>
              {t('Describe in detail what you were doing and the feedback ' +
                  'you would like to submit.')}
            </h4>
            <T i18nKey='feedback-instructions' className='feedback-instructions'>
              Please<br/>
              <ul>
                <li>use punctuation and linebreaks,</li>
                <li>be precise and to the point. You don't have to form sentences.
                  A bug report is a technical document, not prose,</li>
                <li>report only one issue per message,</li>
                <li>avoid making assumptions or your own conclusions, just report what you saw
                  and what you expected to see,</li>
                <li>include an example of how to reproduce the error if you can.
                  Even if its a general problem ("fomods using feature x zig when they should
                  zag") include one sequence of actions that expose the problem.</li>
              </ul>
              Trying to reproduce a bug is usually what takes the most amount of time in
              bug fixing and the less time we spend on it, the more time we can spend
              creating great new features!
            </T>
          </FlexLayout.Fixed>
          <FlexLayout.Flex>
          <Panel>
            <PanelX.Body>
              <FlexLayout type='column'>
                <FlexLayout.Fixed>
                  {t('Your Message')}
                </FlexLayout.Fixed>
                <FlexLayout.Flex fill>
                  {this.renderMessageArea()}
                </FlexLayout.Flex>
                <FlexLayout.Fixed>
                  <Dropzone
                    accept={['files']}
                    icon='folder-download'
                    drop={this.dropFeedback}
                    dropText='Drop files to attach'
                    clickText='Click to browse for files to attach'
                    dialogHint={t('Select file to attach')}
                  />
                </FlexLayout.Fixed>
                <FlexLayout.Fixed>
                  {t('or')}{this.renderAttachButton()}
                </FlexLayout.Fixed>
                <FlexLayout.Fixed>
                  <ListGroup className='feedback-files'>
                    {Object.keys(feedbackFiles).map(this.renderFeedbackFile)}
                  </ListGroup>
                  {this.renderFilesArea()}
                </FlexLayout.Fixed>
              </FlexLayout>
            </PanelX.Body>
          </Panel>
          </FlexLayout.Flex>
        </FlexLayout>
      </MainPage>
    );
  }

  private renderFeedbackFile = (feedbackFile: string) => {
    const { t, feedbackFiles, onRemoveFeedbackFile } = this.props;
    return (
      <ListGroupItem
        key={feedbackFiles[feedbackFile].filename}
      >
        <p style={{ display: 'inline' }}>
          {feedbackFiles[feedbackFile].filename}
        </p>
        <p style={{ display: 'inline' }}>
          {' '}({util.bytesToString(feedbackFiles[feedbackFile].size)})
        </p>
        <tooltip.IconButton
          className='btn-embed btn-line-right'
          id={feedbackFiles[feedbackFile].filename}
          key={feedbackFiles[feedbackFile].filename}
          tooltip={t('Remove')}
          onClick={this.remove}
          icon='delete'
        />
      </ListGroupItem>
    );
  }

  private attachFile(filePath: string, type?: string): Promise<void> {
    const { onAddFeedbackFile } = this.props;
    return fs.statAsync(filePath)
      .then(stats => {
        onAddFeedbackFile({
          filename: path.basename(filePath),
          filePath,
          size: stats.size,
          type: type || path.extname(filePath).slice(1),
        });
      })
      .catch(err => err.code === 'ENOENT'
        ? Promise.resolve()
        : Promise.reject(err));
  }

  private dropFeedback = (type: ControlMode, feedbackFilePaths: string[]) => {
    const { onAddFeedbackFile } = this.props;

    if (feedbackFilePaths.length === 0) {
      return;
    }

    if (type === 'files') {
      Promise.map(feedbackFilePaths, filePath => {
        this.attachFile(filePath);
      }).then(() => null);
    }
  }

  private remove = (evt) => {
    const { onRemoveFeedbackFile } = this.props;
    const feedbackFileId = evt.currentTarget.id;
    onRemoveFeedbackFile(feedbackFileId);
  }

  private renderMessageArea = () => {
    const { t } = this.props;
    const { feedbackMessage } = this.state;
    return (
      <textarea
        value={feedbackMessage || ''}
        id='textarea-feedback'
        className='textarea-feedback'
        onChange={this.handleChange}
        placeholder={t(SAMPLE_REPORT)}
      />
    );
  }

  private renderAttachButton(): JSX.Element {
    const { t } = this.props;
    return (
      <DropdownButton
        id='btn-attach-feedback'
        title={t('Attach Special File')}
        onSelect={this.attach}
        dropup
      >
        <MenuItem eventKey='sysinfo'>{t('System Information')}</MenuItem>
        <MenuItem eventKey='log'>{t('Vortex Log')}</MenuItem>
        <MenuItem eventKey='settings'>{t('Application Settings')}</MenuItem>
        <MenuItem eventKey='state'>{t('Application State')}</MenuItem>
      </DropdownButton>
    );
  }

  private renderFilesArea(): JSX.Element {
    const { t, APIKey, feedbackFiles } = this.props;
    const { anonymous, sending } = this.state;
    return (
      <FlexLayout fill={false} type='row' className='feedback-controls'>
        <FlexLayout.Fixed>
          <Toggle
            checked={anonymous || (APIKey === undefined)}
            onToggle={this.setAnonymous}
            disabled={APIKey === undefined}
          >
            {t('Send anonymously')}
          </Toggle>
        </FlexLayout.Fixed>
        <FlexLayout.Fixed>
          <tooltip.Button
            style={{ display: 'block', marginLeft: 'auto', marginRight: 0 }}
            id='btn-submit-feedback'
            tooltip={t('Submit Feedback')}
            onClick={this.submitFeedback}
            disabled={sending}
          >
            {t('Submit Feedback')}
          </tooltip.Button>
        </FlexLayout.Fixed>
      </FlexLayout>
    );
  }

  private setAnonymous = (value: boolean) => {
    this.nextState.anonymous = value;
  }

  private attach = (eventKey: any) => {
    const { t, onShowDialog } = this.props;
    switch (eventKey) {
      case 'sysinfo': this.addSystemInfo(); break;
      case 'log': this.attachLog(); break;
      case 'settings': {
        onShowDialog('question', t('Confirm'), {
          message: t('This will attach your Vortex setting to the report, not including ' +
            'confidential data like usernames and passwords. ' +
            'We have no control over what third-party extensions store in settings though.'),
          options: { wrap: true },
        }, [
          { label: 'Cancel' },
          { label: 'Continue', action: () => { this.attachState('settings', 'Vortex Settings'); } },
        ]);
        break;
      }
      case 'state': {
        onShowDialog('question', t('Confirm'), {
          message:
          t('This will attach your Vortex state to the report. This includes information about ' +
            'things like your downloaded and installed mods, games, profiles and categories. ' +
            'These could be very useful for understanding your feedback but you have ' +
            'to decide if you are willing to share this information. ' +
            'We will, of course, treat your information as confidential.'),
          options: { wrap: true },
        }, [
          { label: 'Cancel' },
          { label: 'Continue', action: () => { this.attachState('persistent', 'Vortex State'); } },
        ]);
        break;
      }
    }
  }

  private addSystemInfo() {
    const sysInfo: string[] = [
      'Vortex Version: ' + remote.app.getVersion(),
      'Memory: ' + util.bytesToString((process as any).getSystemMemoryInfo().total * 1024),
      'System: ' + `${os.platform()} (${os.release()})`,
    ];
    this.nextState.feedbackMessage = sysInfo.join('\n') + '\n' + this.state.feedbackMessage;
  }

  private attachState(stateKey: string, name: string) {
    const { t, onAddFeedbackFile } = this.props;
    const data: Buffer = Buffer.from(JSON.stringify(this.context.api.store.getState()[stateKey]));
    const filePath = tmpFile({
      prefix: `${stateKey}-`,
      postfix: '.json',
    }, (err, tmpPath: string, fd: number, cleanup: () => void) => {
      fs.writeAsync(fd, data, 0, data.byteLength, 0)
        .then(() => fs.closeAsync(fd))
        .then(() => {
          onAddFeedbackFile({
            filename: name,
            filePath: tmpPath,
            size: data.byteLength,
            type: 'State',
          });
        });
    });
  }

  private attachLog() {
    const { onAddFeedbackFile } = this.props;

    this.attachFile(
      path.join(remote.app.getPath('userData'), 'vortex.log'), 'log');
    this.attachFile(
      path.join(remote.app.getPath('userData'), 'vortex1.log'), 'log');
  }

  private submitFeedback = (event) => {
    const { APIKey, feedbackFiles, onClearFeedbackFiles, onDismissNotification,
            onShowActivity, onShowError } = this.props;
    const { anonymous, feedbackMessage } = this.state;
    const app = appIn || remote.app;

    const notificationId = 'submit-feedback';
    onShowActivity('Submitting feedback', notificationId);

    this.nextState.sending = true;

    const files: string[] = [];
    Object.keys(feedbackFiles).forEach (key => {
      files.push(feedbackFiles[key].filePath);
    });

    const sendAnonymously = anonymous || (APIKey === undefined);

    this.context.api.events.emit('submit-feedback',
                                 feedbackMessage, files, sendAnonymously, (err: Error) => {
      this.nextState.sending = false;
      if (err !== null) {
        if ((err as any).body !== undefined) {
          onShowError('Failed to send feedback', `${err.message} - ${(err as any).body}`,
                      notificationId, false);
        }
        onShowError('Failed to send feedback', err, notificationId, false);
        return;
      }

      this.nextState.feedbackMessage = '';

      let removeFiles: string[];

      if (feedbackFiles !== undefined) {
        removeFiles = Object.keys(feedbackFiles)
          .filter(fileId => ['State', 'Dump', 'LogCopy'].indexOf(feedbackFiles[fileId].type) !== -1)
          .map(fileId => feedbackFiles[fileId].filePath);
      }

      if (removeFiles !== undefined) {
        Promise.map(removeFiles, removeFile => fs.removeAsync(removeFile))
          .then(() => {
            onClearFeedbackFiles();
            onDismissNotification(notificationId);
          })
          .catch(innerErr => {
            onShowError('An error occurred removing a file', innerErr, notificationId);
        });
      }
    });
  }

  private handleChange = (event) => {
    this.nextState.feedbackMessage = event.currentTarget.value;
  }
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onShowActivity: (message: string, id?: string) =>
      util.showActivity(dispatch, message, id),
    onRemoveFeedbackFile: (feedbackFileId: string) =>
      dispatch(removeFeedbackFile(feedbackFileId)),
    onShowDialog: (type, title, content, dialogActions) =>
      dispatch(actions.showDialog(type, title, content, dialogActions)),
    onShowError: (message: string, details?: string | Error,
                  notificationId?: string, allowReport?: boolean) =>
      util.showError(dispatch, message, details, false, notificationId, allowReport),
    onDismissNotification: (id: string) => dispatch(actions.dismissNotification(id)),
    onClearFeedbackFiles: () => dispatch(clearFeedbackFiles()),
    onAddFeedbackFile: (feedbackFile) => dispatch(addFeedbackFile(feedbackFile)),
  };
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    feedbackMessage: state.session.feedback.feedbackMessage,
    feedbackFiles: state.session.feedback.feedbackFiles,
    APIKey: state.confidential.account.nexus.APIKey,
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(
      FeedbackPage)) as React.ComponentClass<{}>;
