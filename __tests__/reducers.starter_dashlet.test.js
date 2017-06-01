import reducer from '../src/extensions/starter_dashlet/reducers';

describe('setPrimaryTool', () => {
  it('sets the Primary Tool', () => {
    let input = { primaryTool: {gameId1: 'value' }};
    let result = reducer.reducers.SET_PRIMARY_TOOL(input, { gameId: 'gameId1', toolId: 'new value' });
    expect(result).toEqual({ primaryTool: { gameId1: 'new value' } });
  });
  it('creates the new gameId and the related toolId if the game doesn\'t exist', () => {
    let input = { primaryTool: {gameId1: 'value' }};
    let result = reducer.reducers.SET_PRIMARY_TOOL(input, { gameId: 'gameId2', toolId: 'new value' });
    expect(result).toEqual({ primaryTool: { gameId1: 'value', gameId2: 'new value' } });
  });
  it('affects only the right game', () => {
    let input = { primaryTool: {gameId1: 'value', gameId2: 'value' }};
    let result = reducer.reducers.SET_PRIMARY_TOOL(input, { gameId: 'gameId2', toolId: 'new value' });
    expect(result).toEqual({ primaryTool: { gameId1: 'value', gameId2: 'new value' } });
  });
});
