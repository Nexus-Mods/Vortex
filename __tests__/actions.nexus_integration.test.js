import * as actions from '../src/extensions/nexus_integration/actions/account';

describe('setUserAPIKey', () => {
  it('creates the correct action', () => {
    expect(actions.setUserAPIKey('apikey')).toEqual({
      error: false,
      type: 'SET_USER_API_KEY',
      payload: 'apikey'
    });
  });
});
