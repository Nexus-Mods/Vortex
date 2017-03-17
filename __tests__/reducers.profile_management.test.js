import { profilesReducer } from '../src/extensions/profile_management/reducers/profiles';

describe('setModEnabled', () => {
  it('set the mod enabled', () => {
    let input = { profileId1: { 'modState': { modId1: { 'enabled': { enable: false } }  } } };
    let result = profilesReducer.reducers.SET_MOD_ENABLED(input, { profileId: 'profileId1', modId: 'modId1', enable: true });
    expect(result).toEqual({ profileId1: { 'modState': { modId1: { 'enabled': true } } } });
  });
  it('fail if the profile doesn\'t exist', () => {
    let input = { profileId1: { 'modState': { modId1: { 'enabled': { enable: false } }  } } };
    let result = profilesReducer.reducers.SET_MOD_ENABLED(input, { profileId: 'profileId2', modId: 'modId1', enable: true });
    expect(result).toEqual({ profileId1: { 'modState': { modId1: { 'enabled': true } } } });
  });
   it('affects only the right profile', () => {
    let input = { profileId1: { 'modState': { modId1: { 'enabled': { enable: false } }  } }, profileId2: { 'modState': { modId1: { 'enabled': { enable: false } }  } } };
    let result = profilesReducer.reducers.SET_MOD_ENABLED(input, { profileId: 'profileId1', modId: 'modId1', enable: true });
    expect(result).toEqual({ profileId1: { 'modState': { modId1: { 'enabled': true } } }, profileId2: { 'modState': { modId1: { 'enabled': {'enable': false} } } } });
  });
});


describe('setFeature', () => {
  it('set the feature', () => {
    let input = { profileId1: { 'features': { featureId1: 'old Value' } } };
    let result = profilesReducer.reducers.SET_FEATURE(input, { profileId: 'profileId1', featureId: 'featureId1', value: 'new Value' });
    expect(result).toEqual({ profileId1: { 'features': {  featureId1: 'new Value' } } });
  });
   it('fail if the profile doesn\'t exist', () => {
    let input = { profileId1: { 'features': { featureId1: 'old Value' } } };
    let result = profilesReducer.reducers.SET_FEATURE(input, { profileId: 'profileId2', featureId: 'featureId1', value: 'new Value' });
    expect(result).toEqual({ profileId1: { 'features': {  featureId1: 'new Value' } } });
  });
   it('affects only the right profile', () => {
    let input = { profileId1: { 'features': { featureId1: 'old Value' } }, profileId2: { 'features': { featureId1: 'old Value' } } };
    let result = profilesReducer.reducers.SET_FEATURE(input, { profileId: 'profileId1', featureId: 'featureId1', value: 'new Value' });
    expect(result).toEqual({ profileId1: { 'features': {  featureId1: 'new Value' } }, profileId2: { 'features': {  featureId1: 'old Value' } } });
  });
});
