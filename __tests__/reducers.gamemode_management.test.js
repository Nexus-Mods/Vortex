import { settingsReducer } from '../src/extensions/gamemode_management/reducers/settings';
import _ from 'lodash';

describe('setToolVisible', () => {
  it('sets the tool visible', () => {
    let input = { discovered: { gameId1: { tools: { toolId1: { hidden: false }} }  } };
    let result = settingsReducer.reducers.SET_TOOL_VISIBLE(input, { gameId: 'gameId1', toolId: 'toolId1', value: true });
    expect(result).toEqual({ discovered: { gameId1: { tools: { toolId1: { hidden: true} } } } });
  });
   it('adds the new tool and set it visible if the tool doesn\'t exist', () => {
    let input = { discovered: { gameId1: { tools: { toolId1: { hidden: false }}}  } };
    let result = settingsReducer.reducers.SET_TOOL_VISIBLE(input, { gameId: 'gameId1', toolId: 'toolId2', value: true });
    expect(result).toEqual({ 'discovered': { gameId1: { 'tools': { toolId1: { hidden: false}, toolId2: {hidden: true} } } } });
  });
  it('creates a new game and add the new visible tool under if the game doesn\'t exist', () => {
    let input = { discovered: { gameId1: { tools: { toolId1: { hidden: false }}}  } };
    let result = settingsReducer.reducers.SET_TOOL_VISIBLE(input, { gameId: 'gameId2', toolId: 'toolId1', value: true });
    expect(result).toEqual({ 'discovered': { gameId1: { 'tools': { toolId1: { hidden: false}}}, gameId2: { 'tools': { toolId1: { hidden: true} }}}});
  });
  it('affects only the right game', () => {
    let input = { discovered: { gameId1: { tools: { toolId1: { hidden: false }}}, gameId2: { tools: { toolId1: { hidden: false }}}  } };
    let result = settingsReducer.reducers.SET_TOOL_VISIBLE(input, { gameId: 'gameId1', toolId: 'toolId1', value: true });
    expect(result).toEqual({ discovered: { gameId1: { tools: { toolId1: { hidden: true} } }, gameId2: { tools: { toolId1: { hidden: false} } } } });
  });
});

describe('setGameHidden', () => {
  it('sets the game hidden', () => {
    let input = { discovered: { gameId1: { hidden: false  }  } };
    let result = settingsReducer.reducers.SET_GAME_HIDDEN(input, { gameId: 'gameId1', hidden: true });
    expect(result).toEqual({ discovered: { gameId1: { hidden: true } } });
  });
  it('creates a new game and set it visible if the game doesn\'t exist', () => {
    let input = { discovered: { gameId1: { 'hidden': false }  } };
    let result = settingsReducer.reducers.SET_GAME_HIDDEN(input, { gameId: 'gameId2', hidden: true });
    expect(result).toEqual({ discovered: { gameId1: { hidden: false  }, gameId2: {hidden: true} } });
  });
  it('affects only the right game', () => {
    let input = { discovered: { gameId1: { hidden: false  }, gameId2: { hidden: false  }  } };
    let result = settingsReducer.reducers.SET_GAME_HIDDEN(input, { gameId: 'gameId1', hidden: true });
    expect(result).toEqual({ discovered: { gameId1: { hidden: true }, gameId2: { hidden: false  } } });
  });
});

describe('addSearchPath', () => {
  it('adds a new drive to the SearchPath array', () => {
    let input = { searchPaths: ['E:','C:'] };
    let result = settingsReducer.reducers.ADD_SEARCH_PATH(input, 'F:');
    expect(result).toEqual({ searchPaths: ['E:','C:', 'F:']   });
  });
   it('fails if the drive already exist', () => {
    let input = { searchPaths: ['E:','C:'] };
    let result = settingsReducer.reducers.ADD_SEARCH_PATH(input, 'C:');
    expect(result).toEqual({ searchPaths: ['E:','C:']   });
  });
});

describe('removeSearchPath', () => {
  it('removes the drive to the SearchPath array', () => {
    let input = { searchPaths: ['E:','C:','F:'] };
    let result = settingsReducer.reducers.REMOVE_SEARCH_PATH(input, 'F:');
    expect(result).toEqual({ searchPaths: ['E:','C:']   });
  });
   it('does nothing if the drive doesn\'t exist', () => {
    let input = { searchPaths: ['E:','C:','F:'] };
    let result = settingsReducer.reducers.REMOVE_SEARCH_PATH(input, 'H:');
    expect(result).toEqual({ searchPaths: ['E:','C:', 'F:']   });
  });
});

describe('setGameParameters', () => {
  it('sets the game parameters', () => {
    let input = { discovered: {gameId1: { workingDirectory: 'C:', iconPath: 'old icon', environment: 'old env', commandLine: 'old line' }} }; 
    let gameParameters = {
      workingDirectory: 'E:',
      iconPath: 'new icon',
      environment: 'new env',
      commandLine: 'new line',
    };
    let result = settingsReducer.reducers.SET_GAME_PARAMETERS(input, { gameId: 'gameId1', parameters: gameParameters });
    expect(result).toEqual({ discovered: {gameId1: gameParameters } });
  });
  it('fails if the game doesn\'t exist', () => {
    let input = { discovered: {gameId1: { workingDirectory: 'C:', iconPath: 'old icon', environment: 'old env', commandLine: 'old line' }} }; 
    let gameParameters = {
      workingDirectory: 'E:',
      iconPath: 'new icon',
      environment: 'new env',
      commandLine: 'new line',
    };
      let oldGameParameters = {
      workingDirectory: 'C:',
      iconPath: 'old icon',
      environment: 'old env',
      commandLine: 'old line',
    };
    let result = settingsReducer.reducers.SET_GAME_PARAMETERS(input, { gameId: 'gameId2', parameters: gameParameters });
    expect(result).toEqual({ discovered: {gameId1: oldGameParameters } });
  });
   it('affects only the right game', () => {
    let input = { discovered: {gameId1: { workingDirectory: 'C:', iconPath: 'old icon', environment: 'old env', commandLine: 'old line' }, gameId2: { workingDirectory: 'C:', iconPath: 'old icon', environment: 'old env', commandLine: 'old line' }} }; 
    let gameParameters = {
      workingDirectory: 'E:',
      iconPath: 'new icon',
      environment: 'new env',
      commandLine: 'new line',
    };
    let oldGameParameters = {
      workingDirectory: 'C:',
      iconPath: 'old icon',
      environment: 'old env',
      commandLine: 'old line',
    };
    let result = settingsReducer.reducers.SET_GAME_PARAMETERS(input, { gameId: 'gameId1', parameters: gameParameters });
    expect(result).toEqual({ discovered: {gameId1: gameParameters, gameId2: oldGameParameters } });
  });
});

describe('addDiscoveredGame', () => {
  it('updates the discovered game params', () => {
    let input = { discovered: { gameId1: { path: 'path1', modPath: 'modPath1' } } }; 
    let game = {
      path: 'path2',
      modPath: 'modPath2',
    };
    let result = settingsReducer.reducers.ADD_DISCOVERED_GAME(input, { id: 'gameId1',  result: game });
    expect(result).toEqual({ discovered: { gameId1: game } });
  });
    it('adds the new game if the game doesn\'t exist', () => {
    let input = { discovered: { gameId1: { path: 'path1', modPath: 'modPath1' } } }; 
    let game = {
      path: 'path2',
      modPath: 'modPath2',
    };
     let oldGame = {
      path: 'path1',
      modPath: 'modPath1',
    };
    let result = settingsReducer.reducers.ADD_DISCOVERED_GAME(input, { id: 'gameId2',  result: game });
    expect(result).toEqual({ discovered: { gameId1: oldGame , gameId2: game }});
  });
  it('affects only the right game', () => {
    let input = { discovered: { gameId1: { path: 'path1', modPath: 'modPath1' }, gameId2: { path: 'path1', modPath: 'modPath1' } } }; 
    let game = {
      path: 'path2',
      modPath: 'modPath2',
    };
     let oldGame = {
      path: 'path1',
      modPath: 'modPath1',
    };
    let result = settingsReducer.reducers.ADD_DISCOVERED_GAME(input, { id: 'gameId1',  result: game });
    expect(result).toEqual({ discovered: { gameId1: game, gameId2: oldGame } });
  });
});

describe('addDiscoveredTool', () => {
  it('updates the discovered tool params', () => {
    let input = { discovered: {gameId1: { tools: { toolId1: { path: 'tool1 path', hidden: false, custom: false, workingDirectory: 'C:' }} } }}; 
    let parameters = {
      path: 'tool2 path',
      hidden: false,
      custom: true,
      workingDirectory: 'C:',
    };
    let result = settingsReducer.reducers.ADD_DISCOVERED_TOOL(input, { gameId: 'gameId1', toolId: 'toolId1',  result: parameters });
    delete result.discovered.gameId1.tools.toolId1.timestamp;
    expect(result).toEqual({ discovered: { gameId1: { tools: { toolId1: parameters } } } });
  });
  it('affects only the right game', () => {
    let input = { discovered: {gameId1: { tools: { toolId1: { path: 'tool1 path', hidden: false, custom: false, workingDirectory: 'C:' }} }, gameId2: { tools: { toolId1: { path: 'tool1 path', hidden: false, custom: false, workingDirectory: 'C:' }} } }}; 
    let parameters = {
      path: 'tool2 path',
      hidden: false,
      custom: true,
      workingDirectory: 'C:',
    };
    let oldParameters = {
      path: 'tool1 path',
      hidden: false,
      custom: false,
      workingDirectory: 'C:',
    };
    let result = settingsReducer.reducers.ADD_DISCOVERED_TOOL(input, { gameId: 'gameId1', toolId: 'toolId1',  result: parameters });
    delete result.discovered.gameId1.tools.toolId1.timestamp;
    delete result.discovered.gameId2.tools.toolId1.timestamp;
    expect(result).toEqual({ discovered: { gameId1: { tools: { toolId1: parameters } }, gameId2: { tools: { toolId1: oldParameters } }  } });
  });
});
