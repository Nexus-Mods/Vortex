import { IFeedbackFile } from '../types/IFeedbackFile';

import { FILE_NAME, SIZE, TYPE } from '../feedbackAttributes';
import ScreenshotDropzone from './ScreenshotDropzone';
import TracelogDropzone from './TracelogDropzone';

import * as update from 'immutability-helper';
import {
  ComponentEx, IconBar, ITableRowAction, MainPage, Table,
  tooltip, types, util,
} from 'nmm-api';
import * as React from 'react';
import { translate } from 'react-i18next';
import { Fixed, Flex, Layout } from 'react-layout-pane';
import { connect } from 'react-redux';

interface IConnectedProps {
  feedbackFiles: { [fileId: string]: IFeedbackFile };
}

interface IActionProps {
  onShowActivity: (message: string, id?: string) => void;
}

type Props = IConnectedProps & IActionProps;

interface IComponentState {
  feedbackMessage: string;
}

class FeedbackPage extends ComponentEx<Props, IComponentState> {
  private savegameActions: ITableRowAction[];

  constructor(props) {
    super(props);

    this.initState({
      feedbackMessage: '',
    });

    this.savegameActions = [
      {
        icon: 'remove',
        title: props.t('Delete'),
        action: this.remove,
      },
    ];
  }

  public render(): JSX.Element {

    const { feedbackFiles, t } = this.props;
    const actions = this.savegameActions;

    return (
      <MainPage>
        <Layout type='column'>
          {this.renderHeader(t)}
          <Flex style={{ height: '100%', overflowY: 'auto' }} >
            <Table
              tableId='feedbackFiles'
              data={feedbackFiles}
              staticElements={[FILE_NAME, SIZE, TYPE]}
              actions={actions}
            />
          </Flex>
          <Fixed>
            <div style={{display: 'table', width: '100%'}}>
              <ScreenshotDropzone />
              <TracelogDropzone />
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
    this.context.api.events.emit('remove-feedback-file', instanceIds[0]);
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
    const { feedbackFiles, onShowActivity } = this.props;
    const { feedbackMessage } = this.state;

    const notificationId = 'submit-feedback';
    onShowActivity('Submitting feedback', notificationId);

    this.setState(update(this.state, {
      feedbackMessage: { $set: '' },
    }));

    this.context.api.events.emit('clear-feedback-files', notificationId, feedbackFiles);
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
