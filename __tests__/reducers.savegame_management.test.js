import { sessionReducer } from '../extensions/gamebryo-savegame-management/src/reducers/session';

describe('setSavegames', () => {
  it('sets the savegames', () => {
    const input = { saves: {} };
    const savegame = {
      id: 'savegame1',
      savegameBind: null,
      attributes: {},
    };
    const result = sessionReducer.reducers.SET_SAVEGAMES(input, { savegames: [ savegame ], truncated: false });
    expect(result).toEqual({ saves: [ savegame ], savesTruncated: false });
  });
  it('updates the list, replacing previously installed saves', () => {
    const input = {
      saves: [
        { id: '', savegameBind: null, attributes: {} },
        { id: '', savegameBind: null, attributes: {} },
      ],
    };
    const newSavegame = {
      id: 'savegame1',
      savegameBind: null,
      attributes: {},
    };
    const result = sessionReducer.reducers.SET_SAVEGAMES(input, { savegames: [ newSavegame ], truncated: false });
    expect(result).toEqual({ saves: [ newSavegame ], savesTruncated: false });
  });
});

describe('updateSavegame', () => {
  it('sets the savegame state', () => {
    const input = { saves: { savegame1: 'savegameState' } };
    const result = sessionReducer.reducers.UPDATE_SAVEGAME(input, { id: 'savegame1', saveGame: 'newSavegameState' });
    expect(result).toEqual({ saves: { savegame1: 'newSavegameState' } });
  });
  it('affects only the right savegame', () => {
    const input = { saves: { savegame1: 'savegameState1', savegame2: 'savegameState2' } };
    const result = sessionReducer.reducers.UPDATE_SAVEGAME(input, { id: 'savegame1', saveGame: 'newSavegameState' });
    expect(result).toEqual({ saves: { savegame1: 'newSavegameState', savegame2: 'savegameState2' } });
  });
});

describe('setSavegameAttribute', () => {
  it('sets the savegame attribute', () => {
    const input = { saves: { savegame1: { 'attributes': { attribute1: 'value' } } } };
    const result = sessionReducer.reducers.SET_SAVEGAME_ATTRIBUTE(input, { id: 'savegame1', attribute: 'attribute1', value: 'new value' });
    expect(result).toEqual({ saves: { savegame1: { 'attributes': { attribute1: 'new value' } } } });
  });
  it('affects only the right savegame', () => {
    const input = { saves: { savegame1: { 'attributes': { attribute1: 'value' } }, savegame2: { 'attributes': { attribute1: 'value' } } } };
    const result = sessionReducer.reducers.SET_SAVEGAME_ATTRIBUTE(input, { id: 'savegame1', attribute: 'attribute1', value: 'new value' });
    expect(result).toEqual({ saves: { savegame1: { 'attributes': { attribute1: 'new value' } }, savegame2: { 'attributes': { attribute1: 'value' } } } });
  });
});

describe('clearSavegames', () => {
  it('clears the savegames', () => {
    const input = { saves: { savegame1: { id: '', savegameBind: null, attributes: {} }, savegame2: { id: '', savegameBind: null, attributes: {} } } };
    const result = sessionReducer.reducers.CLEAR_SAVEGAMES(input);
    expect(result).toEqual({ saves: {} });
  });
});

describe('setSavegamePath', () => {
  it('sets the savegame path', () => {
    const input = { savegamePath: 'value' };
    const result = sessionReducer.reducers.SET_SAVEGAME_PATH(input, {value: 'new value'});
    expect(result).toEqual({savegamePath: { value: 'new value'}});
  });
});







