import * as actions from '../src/extensions/profile_management/actions/profiles';

describe('setModEnabled', () => {
  it('creates the correct action', () => {
    expect(actions.setModEnabled('profileId1', 'modId1', true)).toEqual({
      error: false,
      type: 'SET_MOD_ENABLED',
      payload: { profileId: 'profileId1', modId: 'modId1', enable: true },
    });
  });
});

describe('setFeature', () => {
  it('creates the correct action', () => {
    expect(actions.setFeature('profileId1', 'featureId1', 'test')).toEqual({
      error: false,
      type: 'SET_PROFILE_FEATURE',
      payload: { profileId: 'profileId1', featureId: 'featureId1', value: 'test' },
    });
  });
});
