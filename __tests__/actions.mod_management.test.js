import * as settingsActions from '../src/extensions/mod_management/actions/settings';
import * as modsActions from '../src/extensions/mod_management/actions/mods';

describe('setPath', () => {
  it('creates the correct action', () => {
    expect(settingsActions.setInstallPath('gameId1', 'path1')).toEqual({
      error: false,
      type: 'SET_MOD_INSTALL_PATH',
      payload: { gameId: 'gameId1', path: 'path1' },
    });
  });
});

describe('setActivator', () => {
  it('creates the correct action', () => {
    expect(settingsActions.setActivator('gameId1', 'activatorId1')).toEqual({
      error: false,
      type: 'SET_ACTIVATOR',
      payload: { gameId: 'gameId1', activatorId: 'activatorId1' },
    });
  });
});

describe('addMod', () => {
  it('creates the correct action', () => {
    expect(modsActions.addMod('gameId1', 'mod1')).toEqual({
      error: false,
      type: 'ADD_MOD',
      payload: { gameId: 'gameId1', mod: 'mod1' },
    });
  });
});

describe('removeMod', () => {
  it('creates the correct action', () => {
    expect(modsActions.removeMod('gameId1', 'modId1')).toEqual({
      error: false,
      type: 'REMOVE_MOD',
      payload: { gameId: 'gameId1', modId: 'modId1' },
    });
  });
});

describe('setModState', () => {
  it('creates the correct action', () => {
    expect(modsActions.setModState('gameId1', 'modId1', 'modState1')).toEqual({
      error: false,
      type: 'SET_MOD_STATE',
      payload: { gameId: 'gameId1', modId: 'modId1', modState: 'modState1' },
    });
  });
});

describe('setModInstallationPath', () => {
  it('creates the correct action', () => {
    expect(modsActions.setModInstallationPath('gameId1', 'modId1', 'installPath1')).toEqual({
      error: false,
      type: 'SET_MOD_INSTALLATION_PATH',
      payload: { gameId: 'gameId1', modId: 'modId1', installPath: 'installPath1' },
    });
  });
});

describe('setModAttribute', () => {
  it('creates the correct action', () => {
    expect(modsActions.setModAttribute('gameId1', 'modId1', 'attribute1', 'value1')).toEqual({
      error: false,
      type: 'SET_MOD_ATTRIBUTE',
      payload: { gameId: 'gameId1', modId: 'modId1', attribute: 'attribute1', value: 'value1' },
    });
  });
});

describe('setModAttributes', () => {
  it('creates the correct action', () => {
    expect(modsActions.setModAttributes('gameId1', 'modId1', { attribute1: 'value1', attribute2: 'value2' })).toEqual({
      error: false,
      type: 'SET_MOD_ATTRIBUTES',
      payload: { gameId: 'gameId1', modId: 'modId1', attributes: { attribute1: 'value1', attribute2: 'value2' } },
    });
  });
});