import { accountReducer } from '../src/extensions/nexus_integration/reducers/account';

describe('setUserAPIKey', () => {
  it('sets the key', () => {
    let input = { };
    let result = accountReducer.reducers.SET_USER_API_KEY(input, 'key');
    expect(result.APIKey).toBe('key');
  });
});
