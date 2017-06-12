import { addFeedbackFile, clearFeedbackFiles, removeFeedbackFile } from './actions/session';
import { sessionReducer } from './reducers/session';
import { IFeedbackFile } from './types/IFeedbackFile';

import FeedbackView from './FeedbackView';

import { types } from 'nmm-api';

function init(context: types.IExtensionContext) {

  context.registerMainPage('commenting-o', 'Give Feedback', FeedbackView, {
    hotkey: 'F',
    group: 'support',
  });

  context.registerReducer(['session', 'feedback'], sessionReducer);

  context.once(() => {

    context.api.events.on('add-feedback-file', (feedbackFile: IFeedbackFile) => {
      context.api.store.dispatch(addFeedbackFile(feedbackFile ));

    });

    context.api.events.on('remove-feedback-file', (feedbackFileId: string) => {
      context.api.store.dispatch(removeFeedbackFile(feedbackFileId));

    });

    context.api.events.on('clear-feedback-files', (notificationId: string) => {
      context.api.store.dispatch(clearFeedbackFiles());
      // TO DO - call nexus integration for the server call
      // - wrong clearFeedbackFiles here.

    });
  });

  return true;
}

export default init;
