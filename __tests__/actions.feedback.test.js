import * as sessionActions from '../extensions/feedback/src/actions/session';

describe('addFeedbackFile', () => {
  it('creates the correct action', () => {
    expect(sessionActions.addFeedbackFile('feedbackFile1')).toEqual({
      error: false,
      type: 'ADD_FEEDBACK_FILE',
      payload: { feedbackFile: 'feedbackFile1' },
    });
  });
});

describe('removeFeedbackFile', () => {
  it('creates the correct action', () => {
    expect(sessionActions.removeFeedbackFile('feedbackFileId1')).toEqual({
      error: false,
      type: 'REMOVE_FEEDBACK_FILE',
      payload: { feedbackFileId: 'feedbackFileId1' },
    });
  });
});

describe('clearFeedbackFiles', () => {
  it('creates the correct action', () => {
    expect(sessionActions.clearFeedbackFiles({})).toEqual({
      error: false,
      type: 'CLEAR_FEEDBACK_FILES',
      payload: { },
    });
  });
});

