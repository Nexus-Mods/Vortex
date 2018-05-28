import * as discoveryActions from '../src/extensions/gamemode_management/actions/discovery';
import * as actions from '../src/extensions/gamemode_management/actions/settings';

describe('discoveryProgress', () => {
  it('creates the correct action', () => {
    expect(discoveryActions.discoveryProgress(0, 42, 'dir')).toEqual({
      error: false,
      type: 'DISCOVERY_PROGRESS',
      payload: { idx: 0, percent: 42, directory: 'dir' },
    });
  });
});

describe('setToolVisible', () => {
  it('creates the correct action', () => {
    expect(actions.setToolVisible('gameId1', 'toolId1', true)).toEqual({
      error: false,
      type: 'SET_TOOL_VISIBLE',
      payload: { gameId: 'gameId1', toolId: 'toolId1', visible: true },
    });
  });
});

describe('setGameHidden', () => {
  it('creates the correct action', () => {
    expect(actions.setGameHidden('gameId1', true)).toEqual({
      error: false,
      type: 'SET_GAME_HIDDEN',
      payload: { gameId: 'gameId1', hidden: true },
    });
  });
});

describe('setGameParameters', () => {
  it('creates the correct action', () => {

 let parameters = {
      workingDirectory: 'E:',
      iconPath: 'new icon',
      environment: 'new env',
      commandLine: 'new line',
    };

    expect(actions.setGameParameters('gameId1', parameters)).toEqual({
      error: false,
      type: 'SET_GAME_PARAMETERS',
      payload: { gameId: 'gameId1', parameters },
    });
  });
});

describe('addDiscoveredGame', () => {
  it('creates the correct action', () => {

   let result = {
      path: 'path2',
      modPath: 'modPath2',
      hidden: false,
      tools: [],
      environment: {},
    };

    expect(actions.addDiscoveredGame('gameId1', result)).toEqual({
      error: false,
      type: 'ADD_DISCOVERED_GAME',
      payload: { id: 'gameId1', result },
    });
  });
});

describe('addDiscoveredTool', () => {
  it('creates the correct action', () => {

   let result = {
      path: 'tool2 path',
      hidden: false,
      custom: true,
      workingDirectory: 'C:',
    };

    expect(actions.addDiscoveredTool('gameId1', 'toolId1', result)).toEqual({
      error: false,
      type: 'ADD_DISCOVERED_TOOL',
      payload: { gameId: 'gameId1', toolId: 'toolId1', result },
    });
  });
});
