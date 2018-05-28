import * as actions from '../src/extensions/starter_dashlet/actions';

describe('setPrimaryTool', () => {
  it('sets the Primary Tool', () => {
    expect(actions.setPrimaryTool('gameId1', 'value')).toEqual({
      error: false,
      type: 'SET_PRIMARY_TOOL',
      payload: { gameId: 'gameId1', toolId: 'value' },
    });
  });
});
