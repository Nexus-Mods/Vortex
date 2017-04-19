import * as interfaceActions from '../src/extensions/settings_interface/actions/interface';
import * as automationActions from '../src/extensions/settings_interface/actions/automation';

describe('setLanguage', () => {
  it('creates the correct action', () => {
    expect(interfaceActions.setLanguage('English')).toEqual({
      type: 'SET_USER_LANGUAGE',
      payload: 'English',
    });
  });
});

describe('setAdvancedMode', () => {
  it('creates the correct action', () => {
    expect(interfaceActions.setAdvancedMode(true)).toEqual({
      type: 'SET_ADVANCED_MODE',
      payload: { advanced: true },
    });
  });
});

describe('setProfilesVisible', () => {
  it('creates the correct action', () => {
    expect(interfaceActions.setProfilesVisible(true)).toEqual({
      type: 'SET_PROFILES_VISIBLE',
      payload: { visible: true },
    });
  });
});

describe('setAutoDeployment', () => {
  it('seta Auto Deployment', () => {
    expect(automationActions.setAutoDeployment(true)).toEqual({
      type: 'SET_AUTO_DEPLOYMENT',
      payload: true ,
    });
  });
});


