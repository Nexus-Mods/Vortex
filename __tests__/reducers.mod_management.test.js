import { settingsReducer } from '../src/extensions/mod_management/reducers/settings';
import { modsReducer } from '../src/extensions/mod_management/reducers/mods';

describe('setPath', () => {
  it('sets a path (base, download or installation) for storing things', () => {
    let input = { paths: { gameId1: { key1: 'path' } } };
    let result = settingsReducer.reducers.SET_MOD_PATH(input, { gameId: 'gameId1', key: 'key1', path: 'New path' });
    expect(result).toEqual({ paths: { gameId1: { key1: 'New path' } } });
  });
  it('creates a new game and add the new path under if the game doesn\'t exist', () => {
    let input = { paths: { gameId1: { key1: 'path' } } };
    let result = settingsReducer.reducers.SET_MOD_PATH(input, { gameId: 'gameId2', key: 'key1', path: 'New path' });
    expect(result).toEqual({ paths: { gameId1: { key1: 'path' }, gameId2: { key1: 'New path' }} });
  });
   it('affects only the right game', () => {
    let input = { paths: { gameId1: { key1: 'path' }, gameId2: { key2: 'path2' } } };
    let result = settingsReducer.reducers.SET_MOD_PATH(input, { gameId: 'gameId1', key: 'key1', path: 'New path' });
    expect(result).toEqual({ paths: { gameId1: { key1: 'New path' }, gameId2: { key2: 'path2' } } });
  });
});

describe('setActivator', () => {
  it('sets the activator to use for this game', () => {
    let input = { activator: { gameId1: { activatorId1: 'id' } } };
    let result = settingsReducer.reducers.SET_ACTIVATOR(input, { gameId: 'gameId1', activatorId: 'activatorId1' });
    expect(result).toEqual({ activator: { gameId1: 'activatorId1' } });
  });
  it('adds the new game and sets the activator to use if the game doesn\'t exist', () => {
    let input = { activator: { gameId1: { activatorId1: 'id' } } };
    let newActivator = {
      id: 'activatorId2',
    };
    let result = settingsReducer.reducers.SET_ACTIVATOR(input, { gameId: 'gameId2', activatorId: newActivator });
    expect(result).toEqual({ activator: { gameId1: {activatorId1: 'id'}, gameId2: newActivator } });
  });
   it('affects only the right game', () => {
    let input = { activator: { gameId1: { activatorId1: 'id' }, gameId2: { activatorId2: 'id2' } } };
    let result = settingsReducer.reducers.SET_ACTIVATOR(input, { gameId: 'gameId1', activatorId: 'activatorId1' });
    expect(result).toEqual({ activator: { gameId1: 'activatorId1', gameId2: {'activatorId2': 'id2'} } });
  });
});

describe('removeMod', () => {
  it('removes the mod', () => {
    let input = { gameId1: { modId1: 'id' } };
    let result = modsReducer.reducers.REMOVE_MOD(input, { gameId: 'gameId1', modId: 'modId1' });
    expect(result).toEqual({ gameId1: {} });
  });
  it('fails if the game doesn\'t exist', () => {
    let input = { gameId1: { modId1: 'id' } };
    let result = modsReducer.reducers.REMOVE_MOD(input, { gameId: 'gameId2', modId: 'modId1' });
    expect(result).toEqual({ gameId1: { modId1: 'id' } });
  });
  it('affects only the right game', () => {
    let input = { gameId1: { modId1: 'id' }, gameId2: { modId1: 'id' } };
    let result = modsReducer.reducers.REMOVE_MOD(input, { gameId: 'gameId1', modId: 'modId1' });
    expect(result).toEqual({ gameId1: {}, gameId2: { modId1: 'id' } });
  });
});

describe('setModInstallationPath', () => {
  it('sets the mod installation path', () => {
    let input = { gameId1: { modId1: { installationPath: 'installPath' } } };
    let result = modsReducer.reducers.SET_MOD_INSTALLATION_PATH(input, { gameId: 'gameId1', modId: 'modId1', installPath: 'New installPath' });
    expect(result).toEqual({ gameId1: { modId1: { installationPath: 'New installPath' } } });
  });
  it('does nothing if the game doesn\'t exist', () => {
    let input = { gameId1: { modId1: { installationPath: 'installPath' } } };
    let result = modsReducer.reducers.SET_MOD_INSTALLATION_PATH(input, { gameId: 'gameId2', modId: 'modId1', installPath: 'New installPath' });
    expect(result).toEqual({ gameId1: { modId1: { installationPath: 'installPath' } } });
  });
   it('affects only the right game', () => {
    let input = { gameId1: { modId1: { installationPath: 'installPath' } }, gameId2: { modId1: { installationPath: 'installPath' } } };
    let result = modsReducer.reducers.SET_MOD_INSTALLATION_PATH(input, { gameId: 'gameId1', modId: 'modId1', installPath: 'New installPath' });
    expect(result).toEqual({ gameId1: { modId1: { installationPath: 'New installPath' } }, gameId2: { modId1: { installationPath: 'installPath' } } });
  });
});

describe('setModAttribute', () => {
  it('sets the mod attribute', () => {
    let input = { gameId1: { modId1: { 'attributes': { attribute1: 'value' } } } };
    let result = modsReducer.reducers.SET_MOD_ATTRIBUTE(input, { gameId: 'gameId1', modId: 'modId1', attribute: 'attribute1', value: 'new value' });
    expect(result).toEqual({ gameId1: { modId1: { 'attributes': { attribute1: 'new value' } } } });
  });
  it('fails if the game doesn\'t exist', () => {
    let input = { gameId1: { modId1: { 'attributes': { attribute1: 'value' } } } };
    let result = modsReducer.reducers.SET_MOD_ATTRIBUTE(input, { gameId: 'gameId2', modId: 'modId1', attribute: 'attribute1', value: 'new value' });
    expect(result).toEqual({ gameId1: { modId1: { 'attributes': { attribute1: 'value' } } } });
  });
  it('affects only the right game', () => {
    let input = { gameId1: { modId1: { 'attributes': { attribute1: 'value' } } }, gameId2: { modId1: { 'attributes': { attribute1: 'value' } } } };
    let result = modsReducer.reducers.SET_MOD_ATTRIBUTE(input, { gameId: 'gameId1', modId: 'modId1', attribute: 'attribute1', value: 'new value' });
    expect(result).toEqual({ gameId1: { modId1: { 'attributes': { attribute1: 'new value' } } }, gameId2: { modId1: { 'attributes': { attribute1: 'value' } } } });
  });
});

describe('setModState', () => {
  it('sets the mod state', () => {
    let input = { gameId1: { modId1: { 'state': 'value' } } };
    let result = modsReducer.reducers.SET_MOD_STATE(input, { gameId: 'gameId1', modId: 'modId1', modState: 'new value' });
    expect(result).toEqual({ gameId1: { modId1: { 'state': 'new value' } } });
  });
  it('fails if the game doesn\'t exist', () => {
    let input = { gameId1: { modId1: { 'state': 'value' } } };
    let result = modsReducer.reducers.SET_MOD_STATE(input, { gameId: 'gameId2', modId: 'modId1', modState: 'new value' });
    expect(result).toEqual({ gameId1: { modId1: { 'state': 'value' } } });
  });
   it('affects only the right game', () => {
    let input = { gameId1: { modId1: { 'state': 'value' } }, gameId2: { modId1: { 'state': 'value' } } };
    let result = modsReducer.reducers.SET_MOD_STATE(input, { gameId: 'gameId1', modId: 'modId1', modState: 'new value' });
    expect(result).toEqual({ gameId1: { modId1: { 'state': 'new value' } }, gameId2: { modId1: { 'state': 'value' } } });
  });
});

describe('addMod', () => {
  it('adds a new mod', () => {
    let input = { gameId1: { modId1: {state: '', id: '', installationPath: '', attributes: {}} } };
    let mod = {
      state: 'installing',
      id: 'modId1',
      installationPath: 'path',
      attributes: {},
    };
    let result = modsReducer.reducers.ADD_MOD(input, { gameId: 'gameId1', mod: mod });
    expect(result).toEqual({ gameId1: {modId1: mod} });
  });
  it('creates a new game and add the new mod under if the game doesn\'t exist', () => {
    let input = { gameId1: { modId1: {state: '', id: '', installationPath: '', attributes: {}} } };
    let mod = {
      state: 'installing',
      id: 'modId1',
      installationPath: 'path',
      attributes: {},
    };
     let oldMod = {
      state: '',
      id: '',
      installationPath: '',
      attributes: {},
    };
    let result = modsReducer.reducers.ADD_MOD(input, { gameId: 'gameId2', mod: mod });
    expect(result).toEqual({ gameId1: {modId1: oldMod}, gameId2: {modId1: mod} });
  });
   it('affects only the right game', () => {
    let input = { gameId1: { modId1: {state: '', id: '', installationPath: '', attributes: {}} }, gameId2: { modId1: {state: '', id: '', installationPath: '', attributes: {}} } };
    let mod = {
      state: 'installing',
      id: 'modId1',
      installationPath: 'path',
      attributes: {},
    };
    let oldMod = {
      state: '',
      id: '',
      installationPath: '',
      attributes: {},
    };
    let result = modsReducer.reducers.ADD_MOD(input, { gameId: 'gameId1', mod: mod });
    expect(result).toEqual({ gameId1: {modId1: mod}, gameId2: {modId1: oldMod} });
  });
});
