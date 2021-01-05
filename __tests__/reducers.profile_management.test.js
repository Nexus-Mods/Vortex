import { profilesReducer } from '../src/extensions/profile_management/reducers/profiles';

import * as _ from 'lodash';

describe('setModEnabled', () => {
  it('sets the mod enabled', () => {
    let input = { profileId1: { modState: { modId1: { enabled: false } } } };
    let result = profilesReducer.reducers.SET_MOD_ENABLED(input, { profileId: 'profileId1', modId: 'modId1', enable: true });
    delete result.profileId1.modState.modId1.enabledTime;
    expect(result).toEqual({ profileId1: { modState: { modId1: { enabled: true } } } });
  });
  it('fails if the profile doesn\'t exist', () => {
    let input = { profileId1: { modState: { modId1: { enabled: false } } } };
    let result = profilesReducer.reducers.SET_MOD_ENABLED(input, { profileId: 'profileId2', modId: 'modId1', enable: true });
    delete result.profileId1.modState.modId1.enabledTime;
    expect(result).toEqual({ profileId1: { modState: { modId1: { enabled: false } } } });
  });
   it('affects only the right profile', () => {
    let input = { profileId1: { modState: { modId1: { enabled: false } } }, profileId2: { modState: { modId1: { enabled: false } } } };
    let result = profilesReducer.reducers.SET_MOD_ENABLED(input, { profileId: 'profileId1', modId: 'modId1', enable: true });
    delete result.profileId1.modState.modId1.enabledTime;
    expect(result).toEqual({ profileId1: { modState: { modId1: { enabled: true } } }, profileId2: { modState: { modId1: { enabled: false } } } });
  });
});

describe('setFeature', () => {
  it('sets the value for the profile feature', () => {
    let input = { profileId1: { features: { featureId1: 'value' } } };
    let result = profilesReducer.reducers.SET_PROFILE_FEATURE(input, { profileId: 'profileId1', featureId: 'featureId1', value: 'new Value' });
    expect(result).toEqual({ profileId1: { features: { featureId1: 'new Value' } } });
  });
   it('fails if the profile doesn\'t exist', () => {
    let input = { profileId1: { features: { featureId1: 'value' } } };
    let result = profilesReducer.reducers.SET_PROFILE_FEATURE(input, { profileId: 'profileId2', featureId: 'featureId1', value: 'new Value' });
    expect(result).toEqual({ profileId1: { features: { featureId1: 'value' } } });
  });
   it('affects only the right profile', () => {
    let input = { profileId1: { features: { featureId1: 'value' } }, profileId2: { features: { featureId1: 'value' } } };
    let result = profilesReducer.reducers.SET_PROFILE_FEATURE(input, { profileId: 'profileId1', featureId: 'featureId1', value: 'new Value' });
    expect(result).toEqual({ profileId1: { features: { featureId1: 'new Value' } }, profileId2: { features: { featureId1: 'value' } } });
  });
});
