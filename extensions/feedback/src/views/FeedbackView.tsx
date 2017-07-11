import { addFeedbackFile, clearFeedbackFiles, removeFeedbackFile } from '../actions/session';
import { IFeedbackFile } from '../types/IFeedbackFile';
import { createFeedbackReport } from '../util/createFeedbackReport';

import { app as appIn, remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as update from 'immutability-helper';
import {
  ComponentEx, Dropzone, Icon, IconBar, ITableRowAction, MainPage, Table,
  tooltip, types, util,
} from 'nmm-api';
import * as path from 'path';
import * as React from 'react';
import { Col, ControlLabel, FormGroup, Grid, ListGroup, ListGroupItem, Row } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { Fixed, Flex, Layout } from 'react-layout-pane';
import { connect } from 'react-redux';

type ControlMode = 'urls' | 'files';

interface IConnectedProps {
  feedbackFiles: { [fileId: string]: IFeedbackFile };
}

interface IActionProps {
  onShowActivity: (message: string, id?: string) => void;
  onRemoveFeedbackFile: (feedbackFileId: string) => void;
  onShowError: (message: string, details?: string | Error, notificationId?: string) => void;
  onClearFeedbackFiles: () => void;
  onAddFeedbackFile: (feedbackFile: IFeedbackFile) => void;
}

type Props = IConnectedProps & IActionProps;

interface IComponentState {
  feedbackMessage: string;
}

class FeedbackPage extends ComponentEx<Props, IComponentState> {
  private feedbackActions: ITableRowAction[];

  constructor(props) {
    super(props);

    this.initState({
      feedbackMessage: '',
    });

    this.feedbackActions = [
      {
        icon: 'remove',
        title: props.t('Delete'),
        action: this.remove,
      },
    ];
  }

  public render(): JSX.Element {

    const { feedbackFiles, t } = this.props;
    const actions = this.feedbackActions;

    return (
      <MainPage>
        <Layout type='column'>
          {this.renderHeader(t)}
          <Flex className='table-layout'>
            <FormGroup>
              <ControlLabel>{t('Feedback Files')}</ControlLabel>
              <ListGroup style={{ maxHeight: 160, overflowY: 'scroll' }} >
                {Object.keys(feedbackFiles).map(this.renderFeedbackFile)}
              </ListGroup>
            </FormGroup>
          </Flex>
          <Fixed>
            <div style={{ width: '90%', display: 'inline-block' }}>
              <Dropzone
                accept={['files']}
                drop={this.dropFeedback}
                dialogHint={t('Drop the feedback file here')}
              />
            </div>
            <div className={'btn-line-right'}>
              <div>
                <tooltip.Button
                  className='btn.embed'
                  id='btn-submit-feedback'
                  tooltip={t('Submit Feedback')}
                  onClick={this.submitFeedback}
                >
                  {t('Submit Feedback')}
                </tooltip.Button>
              </div><div>
                <tooltip.Button
                  className='btn.embed'
                  id='btn-attach-log'
                  tooltip={t('Attach Vortex log')}
                  onClick={this.attachLog}
                >
                  {t('Attach Vortex log')}
                </tooltip.Button>
              </div>
            </div>
          </Fixed>
        </Layout>
      </MainPage>
    );
  }

  private renderFeedbackFile = (feedbackFile: string) => {
    const { feedbackFiles, onRemoveFeedbackFile, t } = this.props;
    return (
      <ListGroupItem
        key={feedbackFiles[feedbackFile].filename}
      >
        {feedbackFiles[feedbackFile].filename + ' (' + feedbackFiles[feedbackFile].size + ' Kb)'}
        <tooltip.IconButton
          className='btn-embed btn-line-right'
          id={feedbackFiles[feedbackFile].filename}
          key={feedbackFiles[feedbackFile].filename}
          tooltip={t('Remove')}
          onClick={this.remove}
          icon='remove'
        />
      </ListGroupItem>
    );
  }

  private dropFeedback = (type: ControlMode, feedbackFilePaths: string[]) => {
    const { onAddFeedbackFile } = this.props;

    if (type === 'files') {

      fs.statAsync(feedbackFilePaths[0])
        .then((stats) => {
          const fileSize = stats.size / 1024 !== 0 ? Math.round(stats.size / 1024) : 1;
          const feedbackFile: IFeedbackFile = {
            filename: path.basename(feedbackFilePaths[0]),
            filePath: feedbackFilePaths[0],
            size: fileSize,
            type: path.extname(feedbackFilePaths[0]),
          };

          onAddFeedbackFile(feedbackFile);
        });
    }
  }

  private remove = (evt) => {
    const { onRemoveFeedbackFile } = this.props;
    const feedbackFileId = evt.currentTarget.id;
    onRemoveFeedbackFile(feedbackFileId);
  }

  private renderHeader = (t: I18next.TranslationFunction) => {
    const { feedbackMessage } = this.state;
    return (
      <Fixed className='table-layout'>
        <div>
          <h3>{t('Provide Feedback\n')}</h3>
        </div>
        <div>
          {t('Please note: no personal information will be sent when providing feedback')}
        </div>
        <div>
          <h3>
            {t('Describe in detail what you were doing and the feedback you would like to submit')}
          </h3>
        </div>
        <div>
          <textarea
            value={feedbackMessage}
            id='textarea-feedback'
            className='textarea-feedback'
            onChange={this.handleChange}
            placeholder={t(
              'E.g. \nSubject: Install problem. \nSummary: The mod downloads properly but ' +
              'when I try to install it nothing happens.\n' +
              'Steps to reproduce: Download a mod, then click Install inside the Actions menu. \n' +
              'Expected Results: The mod is installed. \n' +
              'Actual Results: Nothing happens. \n' +
              'Optional: ')}
          />
        </div>
      </Fixed>
    );
  }

  private attachLog = () => {
    const { onAddFeedbackFile } = this.props;

    const logFile = path.join(remote.app.getPath('userData'), 'vortex.log');

    fs.statAsync(logFile)
      .then((stats) => {
        const fileSize = stats.size / 1024 !== 0 ? Math.round(stats.size / 1024) : 1;
        const feedbackFile: IFeedbackFile = {
          filename: path.basename(logFile),
          filePath: logFile,
          size: fileSize,
          type: 'Log',
        };

        onAddFeedbackFile(feedbackFile);
      });
  }

  private submitFeedback = (event) => {
    const { feedbackFiles, onClearFeedbackFiles, onShowActivity, onShowError } = this.props;
    const { feedbackMessage } = this.state;
    const app = appIn || remote.app;

    const feedbackReport = createFeedbackReport('feedback', feedbackMessage, app.getVersion());

    const notificationId = 'submit-feedback';
    onShowActivity('Submitting feedback', notificationId);

    this.setState(update(this.state, {
      feedbackMessage: { $set: '' },
    }));

    // TODO: - call nexus integration for the server call

    const nativeCrashesPath = path.join(remote.app.getPath('userData'), 'temp', 'Vortex Crashes');
    let nativeCrashFile;

    if (feedbackFiles !== undefined) {
      nativeCrashFile = Object.keys(feedbackFiles).find((file) => path.extname(file) === '.dmp');
    }

    if (nativeCrashFile !== undefined) {
      fs.removeAsync(path.join(nativeCrashesPath, nativeCrashFile))
        .then(() => {
          onClearFeedbackFiles();
        })
        .catch((err) => {
          onShowError('An error occurred removing the dump file: ', err, notificationId);
        });
    }
  }

  private handleChange = (event) => {
    this.setState(update(this.state, {
      feedbackMessage: { $set: event.currentTarget.value },
    }));

  }
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onShowActivity: (message: string, id?: string) =>
      util.showActivity(dispatch, message, id),
    onRemoveFeedbackFile: (feedbackFileId: string) =>
      dispatch(removeFeedbackFile(feedbackFileId)),
    onShowError: (message: string, details?: string | Error, notificationId?: string) =>
      util.showError(dispatch, message, details, false, notificationId),
    onClearFeedbackFiles: () => dispatch(clearFeedbackFiles()),
    onAddFeedbackFile: (feedbackFile) => dispatch(addFeedbackFile(feedbackFile)),
  };
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    feedbackFiles: state.session.feedback.feedbackFiles,
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(FeedbackPage),
  ) as React.ComponentClass<{}>;
