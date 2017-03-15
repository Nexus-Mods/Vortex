import { settingsReducer } from '../src/extensions/gamemode_management/reducers/settings';

describe('setToolVisible', () => {
  it('set the tool visible', () => {
    let input = { 'discovered': { gameId1: { 'tools': { toolId1: { hidden: false }} }  } };
    let result = settingsReducer.reducers.SET_TOOL_VISIBLE(input, { gameId: 'gameId1', toolId: 'toolId1', value: true });
    expect(result).toEqual({ 'discovered': { gameId1: { 'tools': { toolId1: { hidden: true} } } } });
  });
   it('fail if the tool doesn\'t exist', () => {
    let input = { 'discovered': { gameId1: { 'tools': { toolId1: { hidden: false }}}  } };
    let result = settingsReducer.reducers.SET_TOOL_VISIBLE(input, { gameId: 'gameId1', toolId: 'toolId2', value: true });
    expect(result).toEqual({ 'discovered': { gameId1: { 'tools': { toolId1: { hidden: true} } } } });
  });
});

describe('setGameHidden', () => {
  it('set the game hidden', () => {
    let input = { 'discovered': { gameId1: { 'hidden': false  }  } };
    let result = settingsReducer.reducers.SET_GAME_HIDDEN(input, { gameId: 'gameId1', hidden: true });
    expect(result).toEqual({ 'discovered': { gameId1: { 'hidden': true } } });
  });
  it('fail if the game doesn\'t exist', () => {
    let input = { 'discovered': { gameId1: { 'hidden': false }  } };
    let result = settingsReducer.reducers.SET_GAME_HIDDEN(input, { gameId: 'gameId2', hidden: true });
    expect(result).toEqual({ 'discovered': { gameId1: { 'hidden': true  }  } });
  });
});

describe('addSearchPath', () => {
  it('add the search path', () => {
    let input = { 'searchPaths': ['E:','C:'] };
    let result = settingsReducer.reducers.ADD_SEARCH_PATH(input, 'F:');
    expect(result).toEqual({ 'searchPaths': ['E:','C:', 'F:']   });
  });
});

describe('removeSearchPath', () => {
  it('remove the search path', () => {
    let input = { 'searchPaths': ['E:','C:','F:'] };
    let result = settingsReducer.reducers.REMOVE_SEARCH_PATH(input, 'F:');
    expect(result).toEqual({ 'searchPaths': ['E:','C:']   });
  });
});

describe('setGameParameters', () => {
  it('set the game parameters', () => {
    let input = { 'discovered': {gameId1: { workingDirectory: 'C:', iconPath: 'old icon', environment: 'old env', commandLine: 'old line' }} }; 
    let gameParameters = {
      workingDirectory: 'E:',
      iconPath: 'new icon',
      environment: 'new env',
      commandLine: 'new line',
    };
    let result = settingsReducer.reducers.SET_GAME_PARAMETERS(input, { gameId: 'gameId1', parameters: gameParameters });
    expect(result).toEqual({ 'discovered': {gameId1: gameParameters } });
  });
  it('fail if the game doesn\'t exist', () => {
    let input = { 'discovered': {gameId1: { workingDirectory: 'C:', iconPath: 'old icon', environment: 'old env', commandLine: 'old line' }} }; 
    let gameParameters = {
      workingDirectory: 'E:',
      iconPath: 'new icon',
      environment: 'new env',
      commandLine: 'new line',
    };
    let result = settingsReducer.reducers.SET_GAME_PARAMETERS(input, { gameId: 'gameId2', parameters: gameParameters });
    expect(result).toEqual({ 'discovered': {gameId1: gameParameters } });
  });
});

describe('addDiscoveredGame', () => {
  it('add the discovered game', () => {
    let input = { 'discovered': { gameId1: { path: 'path1', modPath: 'modPath1' } } }; 
    let game = {
      path: 'path2',
      modPath: 'modPath2',
    };
    let result = settingsReducer.reducers.ADD_DISCOVERED_GAME(input, { id: 'gameId1',  result: game });
    expect(result).toEqual({ 'discovered': { gameId1: game } });
  });
    it('fail if the game doesn\'t exist', () => {
    let input = { 'discovered': { gameId1: { path: 'path1', modPath: 'modPath1' } } }; 
    let game = {
      path: 'path2',
      modPath: 'modPath2',
    };
    let result = settingsReducer.reducers.ADD_DISCOVERED_GAME(input, { id: 'gameId2',  result: game });
    expect(result).toEqual({ 'discovered': { gameId1: game } });
  });
});

describe('addDiscoveredTool', () => {
  it('add the discovered tool', () => {
    let input = { 'discovered': {gameId1: { 'tools': { toolId1: { path: 'tool1 path', hidden: false, custom: false, workingDirectory: 'C:' }} } }}; 
    let parameters = {
      path: 'tool2 path',
      hidden: false,
      custom: true,
      workingDirectory: 'C:',
    };
    let result = settingsReducer.reducers.ADD_DISCOVERED_TOOL(input, { gameId: 'gameId1', toolId: 'toolId1',  result: parameters });
    expect(result).toEqual({ 'discovered': { gameId1: { 'tools': { toolId1: parameters } } } });
  });
   it('fail if the game doesn\'t exist', () => {
    let input = { 'discovered': {gameId1: { 'tools': { toolId1: { path: 'tool1 path', hidden: false, custom: false, workingDirectory: 'C:' }} } } }; 
    let parameters = {
      path: 'tool2 path',
      hidden: false,
      custom: true,
      workingDirectory: 'C:',
    };
    let result = settingsReducer.reducers.ADD_DISCOVERED_TOOL(input, { gameId: 'gameId2', toolId: 'tool2',  result: parameters });
    expect(result).toEqual({ 'discovered': { gameId1: { 'tools': { toolId1: parameters } } } });
  });
});
