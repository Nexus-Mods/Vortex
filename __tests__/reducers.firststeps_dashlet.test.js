import settingsReducer from '../src/extensions/firststeps_dashlet/reducers';

describe('dismissStep', () => {
  it('dismisses a todo message from the "first steps" list', () => {
    let input = { steps: {stepId1: true}};
    let result = settingsReducer.reducers.DISMISS_STEP(input, 'stepId1');
    expect(result).toEqual({ steps: {stepId1: true}});
  });
});
