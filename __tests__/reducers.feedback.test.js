import { sessionReducer } from '../extensions/feedback/src/reducers/session';

describe('addFeedbackFile', () => {
  it('adds a new feedback file', () => {
    let input = { feedbackFiles: {} };
    let feedbackFile = {
      filename: 'filename1',
      filepath: 'filePath',
      type: 'screenshot',
      size: '100',
      gameId: 'Skyrim',
    };
    let result = sessionReducer.reducers.ADD_FEEDBACK_FILE(input, { filename: 'filename1', feedbackFile: feedbackFile });
    expect(result).toEqual({ feedbackFiles: { filename1: feedbackFile } });
  });
  it('overwrites an existing feedback file', () => {
    let input = { feedbackFiles: { filename1: { filename: 'filename1', filepath: '', type: '', size: 0, gameId: '' } } };
    let feedbackFile = {
      filename: 'filename1',
      filepath: 'filePath',
      type: 'screenshot',
      size: '100',
      gameId: 'Skyrim',
    };
    let result = sessionReducer.reducers.ADD_FEEDBACK_FILE(input, { filename: 'filename1', feedbackFile: feedbackFile });
    expect(result).toEqual({ feedbackFiles: { filename1: feedbackFile } });
  });
  it('affects only the right feedback file', () => {
    let input = {
      feedbackFiles: {
        filename1: { filename: 'filename1', filepath: '', type: '', size: 0, gameId: '' },
        filename2: { filename: 'filename2', filepath: '', type: '', size: 0, gameId: '' }
      }
    };
    let feedbackFile = {
      filename: 'filename2',
      filepath: 'filePath',
      type: 'screenshot',
      size: '100',
      gameId: 'Skyrim',
    };
    let oldFeedbackFile = {
      filename: 'filename1',
      filepath: '',
      type: '',
      size: 0,
      gameId: '',
    };
    let result = sessionReducer.reducers.ADD_FEEDBACK_FILE(input, { filename: 'filename1', feedbackFile: feedbackFile });
    expect(result).toEqual({ feedbackFiles: { filename1: oldFeedbackFile, filename2: feedbackFile } });
  });
});

describe('removeFeedbackFile', () => {
  it('removes the feedback file', () => {
    let input = { feedbackFiles: { filename1: { filename: 'filename1', filepath: 'filepath', type: 'screenshot', size: 100, gameId: 'Skyrim' } } };
    let result = sessionReducer.reducers.REMOVE_FEEDBACK_FILE(input, { feedbackFileId: 'filename1' });
    expect(result).toEqual({ feedbackFiles: {} });
  });
  it('fails if the feedback file doesn\'t exist', () => {
    let input = { feedbackFiles: { filename1: { filename: 'filename1', filepath: 'filepath', type: 'screenshot', size: 100, gameId: 'Skyrim' } } };
    let result = sessionReducer.reducers.REMOVE_FEEDBACK_FILE(input, { feedbackFileId: 'filename2' });
    expect(result).toEqual({ feedbackFiles: { filename1: { filename: 'filename1', filepath: 'filepath', type: 'screenshot', size: 100, gameId: 'Skyrim' } } });
  });
  it('affects only the right feedback file', () => {
    let input = {
      feedbackFiles: {
        filename1: { filename: 'filename1', filepath: 'filepath', type: 'screenshot', size: 100, gameId: 'Skyrim' },
        filename2: { filename: 'filename2', filepath: 'filepath2', type: 'screenshot', size: 200, gameId: 'Skyrim' }
      }
    };
    let result = sessionReducer.reducers.REMOVE_FEEDBACK_FILE(input, { feedbackFileId: 'filename2' });
    expect(result).toEqual({ feedbackFiles: { filename1: { filename: 'filename1', filepath: 'filepath', type: 'screenshot', size: 100, gameId: 'Skyrim' } } });
  });
});

describe('clearFeedbackFiles', () => {
  it('clears the feedback files', () => {
    let input = { feedbackFiles: { filename1: { filename: 'filename1', filepath: 'filepath', type: 'screenshot', size: 100, gameId: 'Skyrim' } } };
    let result = sessionReducer.reducers.CLEAR_FEEDBACK_FILES(input);
    expect(result).toEqual({ feedbackFiles: {} });
  });
});