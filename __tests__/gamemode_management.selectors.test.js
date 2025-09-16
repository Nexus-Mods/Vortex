import { currentGameDiscovery, gameName, knownGames } from '../src/extensions/gamemode_management/selectors';

describe('knownGames', () => {
  it('returns the known games', function () {
    const input = { session: { gameMode: { known: ['Skyrim', 'FalloutNV'] } } };
    const result = knownGames(input);
    expect(result).toEqual(['Skyrim', 'FalloutNV']);
  });
});

describe('currentGameDiscovery', () => {
  it('returns the discovery information about a game', function () {

    const gameMode1 = {
      path: 'path',
      modPath: 'modPath'
    };

    const activeProfileId1 = {
      gameId: 'gameId',
      id: 'id'
    };

    const input = {
      settings: {
        gameMode: { discovered: { gameId: 'gameMode1' } },
        profiles: { activeProfileId: 'activeProfileId1' }
      },
      persistent: { profiles: { activeProfileId1 } }
    };
    const result = currentGameDiscovery(input);
    expect(result).toEqual('gameMode1');
  });
});

describe('gameName', () => {
  it('returns the game name finding it inside the session', function () {

    const firstGameStored = {
      id: 'id1',
      name: 'name1'
    };

    const secondGameStored = {
      id: 'id2',
      name: 'name2'
    };

    const input = { session: { gameMode: { known: [firstGameStored, secondGameStored] } } };
    const result = gameName(input, 'id1');
    expect(result).toEqual('name1');
  });

  it('returns the game name finding it inside the settings', function () {
    const input = { settings: { gameMode: { discovered: { gameId1: { name: 'name' } } } } };
    const result = gameName(input, 'gameId1');
    expect(result).toEqual('name');
  });
});
