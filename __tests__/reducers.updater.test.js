import reducer from '../src/extensions/updater/reducers';

describe('setUpdateChannel', () => {
  it('sets the Update Channel', () => {
    const input = { channel: 'value' };
    const result = reducer.reducers.SET_UPDATE_CHANNEL(input, 'new value' );
    expect(result).toEqual({ channel: 'new value' });
  });
});
