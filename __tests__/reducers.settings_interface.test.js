import settingsReducer from '../src/extensions/settings_interface/reducers/interface';
import automationReducer from '../src/extensions/settings_interface/reducers/automation';

describe('setLanguage', () => {
  it('sets the Language', () => {
    const input = { language: '' };
    const result = settingsReducer.reducers.SET_USER_LANGUAGE(input, 'English');
    expect(result).toEqual({ language: 'English' });
  });
});

describe('setAdvancedMode', () => {
  it('sets the Advanced Mode', () => {
    const input = { advanced: false };
    const result = settingsReducer.reducers.SET_ADVANCED_MODE(input, {advanced: true});
    expect(result).toEqual({ advanced: true });
  });
});

describe('setProfilesVisible', () => {
  it('sets the Profile Visible', () => {
    const input = { profilesVisible: false };
    const result = settingsReducer.reducers.SET_PROFILES_VISIBLE(input, {visible: true});
    expect(result).toEqual({ profilesVisible: true });
  });
});

describe('setAutoDeployment', () => {
  it('sets Auto Deployment', () => {
    const input = { deploy: false };
    const result = automationReducer.reducers.SET_AUTO_DEPLOYMENT(input, true);
    expect(result).toEqual({ deploy: true });
  });
});

