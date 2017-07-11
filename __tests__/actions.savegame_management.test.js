import * as sessionActions from '../extensions/gamebryo-savegame-management/src/actions/session';

describe('setSavegames', () => {
  it('creates the correct action', () => {
    expect(sessionActions.setSavegames('savegame1')).toEqual({
      type: 'SET_SAVEGAMES',
      payload: 'savegame1' ,
    });
  });
});

describe('setSavegameState', () => {
  it('creates the correct action', () => {
    expect(sessionActions.setSavegameState('savegame1', 'new value')).toEqual({
      type: 'SET_SAVEGAME_STATE',
      payload: {id: 'savegame1', savegameState: 'new value'},
    });
  });
});

describe('setSavegameAttribute', () => {
  it('creates the correct action', () => {
    expect(sessionActions.setSavegameAttribute('savegame1', 'attribute1', 'new value')).toEqual({
      type: 'SET_SAVEGAME_ATTRIBUTE',
      payload: {id: 'savegame1', attribute: 'attribute1', value: 'new value'},
    });
  });
});

describe('clearSavegames', () => {
  it('creates the correct action', () => {
    expect(sessionActions.clearSavegames()).toEqual({
      type: 'CLEAR_SAVEGAMES',
      payload: undefined,
    });
  });
});

describe('removeSavegame', () => {
  it('creates the correct action', () => {
    expect(sessionActions.removeSavegame('savegame1')).toEqual({
      type: 'REMOVE_SAVEGAME',
      payload: 'savegame1',
    });
  });
});

describe('setSavegamePath', () => {
  it('creates the correct action', () => {
    expect(sessionActions.setSavegamePath('savegamePath1')).toEqual({
      type: 'SET_SAVEGAME_PATH',
      payload: 'savegamePath1',
    });
  });
});
