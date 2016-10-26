import * as actions from '../out/extensions/nexus_integration/actions/account';

describe('setUserAPIKey', () => {
  it('creates the correct action', () => {
    expect(actions.setUserAPIKey('apikey')).toEqual({
      type: 'SET_USER_API_KEY',
      payload: 'apikey'
    });
  });
});
