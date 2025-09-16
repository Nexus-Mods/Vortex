import { sessionReducer } from '../extensions/feedback/src/reducers/session';

describe('addFeedbackFile', () => {
  it('adds a new feedback file', () => {
    const input = { feedbackFiles: {} };
    const feedbackFile = {
      filename: 'filename1',
      filepath: 'filePath',
      type: 'screenshot',
      size: '100',
      gameId: 'Skyrim',
    };
    const result = sessionReducer.reducers.ADD_FEEDBACK_FILE(input, { filename: 'filename1', feedbackFile: feedbackFile });
    expect(result).toEqual({ feedbackFiles: { filename1: feedbackFile } });
  });
  it('overwrites an existing feedback file', () => {
    const input = { feedbackFiles: { filename1: { filename: 'filename1', filepath: '', type: '', size: 0, gameId: '' } } };
    const feedbackFile = {
      filename: 'filename1',
      filepath: 'filePath',
      type: 'screenshot',
      size: '100',
      gameId: 'Skyrim',
    };
    const result = sessionReducer.reducers.ADD_FEEDBACK_FILE(input, { filename: 'filename1', feedbackFile: feedbackFile });
    expect(result).toEqual({ feedbackFiles: { filename1: feedbackFile } });
  });
  it('affects only the right feedback file', () => {
    const input = {
      feedbackFiles: {
        filename1: { filename: 'filename1', filepath: '', type: '', size: 0, gameId: '' },
        filename2: { filename: 'filename2', filepath: '', type: '', size: 0, gameId: '' }
      }
    };
    const feedbackFile = {
      filename: 'filename2',
      filepath: 'filePath',
      type: 'screenshot',
      size: '100',
      gameId: 'Skyrim',
    };
    const oldFeedbackFile = {
      filename: 'filename1',
      filepath: '',
      type: '',
      size: 0,
      gameId: '',
    };
    const result = sessionReducer.reducers.ADD_FEEDBACK_FILE(input, { filename: 'filename1', feedbackFile: feedbackFile });
    expect(result).toEqual({ feedbackFiles: { filename1: oldFeedbackFile, filename2: feedbackFile } });
  });
});

describe('removeFeedbackFile', () => {
  it('removes the feedback file', () => {
    const input = { feedbackFiles: { filename1: { filename: 'filename1', filepath: 'filepath', type: 'screenshot', size: 100, gameId: 'Skyrim' } } };
    const result = sessionReducer.reducers.REMOVE_FEEDBACK_FILE(input, { feedbackFileId: 'filename1' });
    expect(result).toEqual({ feedbackFiles: {} });
  });
  it('fails if the feedback file doesn\'t exist', () => {
    const input = { feedbackFiles: { filename1: { filename: 'filename1', filepath: 'filepath', type: 'screenshot', size: 100, gameId: 'Skyrim' } } };
    const result = sessionReducer.reducers.REMOVE_FEEDBACK_FILE(input, { feedbackFileId: 'filename2' });
    expect(result).toEqual({ feedbackFiles: { filename1: { filename: 'filename1', filepath: 'filepath', type: 'screenshot', size: 100, gameId: 'Skyrim' } } });
  });
  it('affects only the right feedback file', () => {
    const input = {
      feedbackFiles: {
        filename1: { filename: 'filename1', filepath: 'filepath', type: 'screenshot', size: 100, gameId: 'Skyrim' },
        filename2: { filename: 'filename2', filepath: 'filepath2', type: 'screenshot', size: 200, gameId: 'Skyrim' }
      }
    };
    const result = sessionReducer.reducers.REMOVE_FEEDBACK_FILE(input, { feedbackFileId: 'filename2' });
    expect(result).toEqual({ feedbackFiles: { filename1: { filename: 'filename1', filepath: 'filepath', type: 'screenshot', size: 100, gameId: 'Skyrim' } } });
  });
});

describe('clearFeedbackFiles', () => {
  it('clears the feedback files', () => {
    const input = { feedbackFiles: { filename1: { filename: 'filename1', filepath: 'filepath', type: 'screenshot', size: 100, gameId: 'Skyrim' } } };
    const result = sessionReducer.reducers.CLEAR_FEEDBACK_FILES(input);
    expect(result).toEqual({ feedbackFiles: {} });
  });
});