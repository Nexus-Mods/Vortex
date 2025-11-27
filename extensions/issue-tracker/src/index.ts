import Issues from './Issues';
import persistentReducer from './reducers/persistent';
import sessionReducer from './reducers/session';

import FeedbackResponderDialog from './FeedbackResponderDialog';

import * as path from 'path';
import { types, util } from 'vortex-api';

function main(context: types.IExtensionContext) {
  context.registerReducer(['persistent', 'issues'], persistentReducer);
  context.registerReducer(['session', 'issues'], sessionReducer);

  context.registerDashlet('Issues', 1, 2, 200, Issues,
    (state: types.IState) =>
      util.getSafe(state, ['confidential', 'account', 'nexus', 'APIKey'], undefined) !== undefined,
  () => ({}), { closable: true });

  context.registerDialog('feedback-responder', FeedbackResponderDialog);

  context.once(() => {
    context.api.setStylesheet('issue-tracker',
      path.join(__dirname, 'issue_tracker.scss'));
  });

  return true;
}

export default main;
