import { clearFeedbackFiles, removeFeedbackFile } from '../actions/session';
import { IFeedbackFile } from '../types/IFeedbackFile';

import { FILE_NAME, GAME, SIZE, TYPE } from '../feedbackAttributes';

import FeedbackDropzone from './FeedbackDropzone';

import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as update from 'immutability-helper';
import {
  ComponentEx, IconBar, ITableRowAction, MainPage, Table,
  tooltip, types, util,
} from 'nmm-api';
import * as path from 'path';
import * as React from 'react';
import { translate } from 'react-i18next';
import { Fixed, Flex, Layout } from 'react-layout-pane';
import { connect } from 'react-redux';

interface IConnectedProps {
  feedbackFiles: { [fileId: string]: IFeedbackFile };
}

interface IActionProps {
  onShowActivity: (message: string, id?: string) => void;
  onRemoveFeedbackFile: (feedbackFileId: string) => void;
  onShowError: (message: string, details?: string | Error, notificationId?: string) => void;
  onClearFeedbackFiles: () => void;
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
          <Flex style={{ height: '100%', overflowY: 'auto' }} >
            <Table
              tableId='feedbackFiles'
              data={feedbackFiles}
              staticElements={[FILE_NAME, GAME, SIZE, TYPE]}
              actions={actions}
            />
          </Flex>
          <Fixed>
            <div style={{ display: 'table', width: '100%' }}>
              <FeedbackDropzone
                feedbackType='screenshot'
              />
              <FeedbackDropzone
                feedbackType='tracelog'
              />
              <span>
                <tooltip.Button
                  className='btn.embed'
                  id='btn-submit-feedback'
                  tooltip={t('Cancel')}
                  onClick={this.submitFeedback}
                >
                  {t('Submit Feedback')}
                </tooltip.Button>
              </span>
            </div>
          </Fixed>
        </Layout>
      </MainPage>
    );
  }

  private remove = (instanceIds: string[]) => {
    const { onRemoveFeedbackFile } = this.props;
    onRemoveFeedbackFile(instanceIds[0]);
  }

  private renderHeader(t: I18next.TranslationFunction) {
    const { feedbackMessage } = this.state;
    return (
      <Fixed className='table-layout'>
        <div>
          <h3>{t('Provide Feedback\n')}</h3>
        </div>
        <div>
          {t('Please note: no personal information will be sent whrn providing feedback')}
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
            placeholder={t('When I began to use Vortex')}
          />
        </div>
      </Fixed>
    );
  }

  private submitFeedback = (event) => {
    const { feedbackFiles, onClearFeedbackFiles, onShowActivity, onShowError } = this.props;
    const { feedbackMessage } = this.state;

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
