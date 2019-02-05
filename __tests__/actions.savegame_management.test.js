import * as sessionActions from '../extensions/gamebryo-savegame-management/src/actions/session';

describe('setSavegames', () => {
  it('creates the correct action', () => {
    expect(sessionActions.setSavegames('savegame1', false)).toEqual({
      error: false,
      type: 'SET_SAVEGAMES',
      payload: {
        savegames: 'savegame1',
        truncated: false,
      },
    });
  });
});

describe('updateSavegame', () => {
  it('creates the correct action', () => {
    expect(sessionActions.updateSavegame('savegame1', 'new value')).toEqual({
      error: false,
      type: 'UPDATE_SAVEGAME',
      payload: {id: 'savegame1', saveGame: 'new value'},
    });
  });
});

describe('setSavegameAttribute', () => {
  it('creates the correct action', () => {
    expect(sessionActions.setSavegameAttribute('savegame1', 'attribute1', 'new value')).toEqual({
      error: false,
      type: 'SET_SAVEGAME_ATTRIBUTE',
      payload: {id: 'savegame1', attribute: 'attribute1', value: 'new value'},
    });
  });
});

describe('clearSavegames', () => {
  it('creates the correct action', () => {
    expect(sessionActions.clearSavegames()).toEqual({
      error: false,
      type: 'CLEAR_SAVEGAMES',
      payload: undefined,
    });
  });
});

describe('removeSavegame', () => {
  it('creates the correct action', () => {
    expect(sessionActions.removeSavegame('savegame1')).toEqual({
      error: false,
      type: 'REMOVE_SAVEGAME',
      payload: 'savegame1',
    });
  });
});

describe('setSavegamePath', () => {
  it('creates the correct action', () => {
    expect(sessionActions.setSavegamePath('savegamePath1')).toEqual({
      error: false,
      type: 'SET_SAVEGAME_PATH',
      payload: 'savegamePath1',
    });
  });
});
