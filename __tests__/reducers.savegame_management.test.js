import { sessionReducer } from '../extensions/gamebryo-savegame-management/src/reducers/session';

describe('setSavegames', () => {
  it('sets the savegames', () => {
    let input = { saves: {} };
    let savegame = {
      id: 'savegame1',
      savegameBind: null,
      attributes: {},
    };
    let result = sessionReducer.reducers.SET_SAVEGAMES(input, { savegame1: savegame });
    expect(result).toEqual({ saves: { savegame1: savegame } });
  });
  it('updates the list adding only the new savegame passed', () => {
    let input = {
      saves: {
        savegame1: { id: '', savegameBind: null, attributes: {} },
        savegame2: { id: '', savegameBind: null, attributes: {} }
      }
    };
    let newSavegame = {
      id: 'savegame1',
      savegameBind: null,
      attributes: {},
    };
    let result = sessionReducer.reducers.SET_SAVEGAMES(input, { savegame1: newSavegame });
    expect(result).toEqual({ saves: { savegame1: newSavegame } });
  });
});

describe('setSavegameState', () => {
  it('sets the savegame state', () => {
    let input = { saves: { savegame1: { state: 'savegameState' } } };
    let result = sessionReducer.reducers.SET_SAVEGAME_STATE(input, { id: 'savegame1', savegameState: 'newSavegameState' });
    expect(result).toEqual({ saves: { savegame1: { state: 'newSavegameState' } } });
  });
  it('affects only the right savegame', () => {
    let input = { saves: { savegame1: { state: 'savegameState' }, savegame2: { state: 'savegameState' } } };
    let result = sessionReducer.reducers.SET_SAVEGAME_STATE(input, { id: 'savegame1', savegameState: 'newSavegameState' });
    expect(result).toEqual({ saves: { savegame1: { state: 'newSavegameState' }, savegame2: { state: 'savegameState' } } });
  });
});

describe('setSavegameAttribute', () => {
  it('sets the savegame attribute', () => {
    let input = { saves: { savegame1: { 'attributes': { attribute1: 'value' } } } };
    let result = sessionReducer.reducers.SET_SAVEGAME_ATTRIBUTE(input, { id: 'savegame1', attribute: 'attribute1', value: 'new value' });
    expect(result).toEqual({ saves: { savegame1: { 'attributes': { attribute1: 'new value' } } } });
  });
  it('affects only the right savegame', () => {
    let input = { saves: { savegame1: { 'attributes': { attribute1: 'value' } }, savegame2: { 'attributes': { attribute1: 'value' } } } };
    let result = sessionReducer.reducers.SET_SAVEGAME_ATTRIBUTE(input, { id: 'savegame1', attribute: 'attribute1', value: 'new value' });
    expect(result).toEqual({ saves: { savegame1: { 'attributes': { attribute1: 'new value' } }, savegame2: { 'attributes': { attribute1: 'value' } } } });
  });
});
