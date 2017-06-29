import { currentGameDiscovery, gameName, knownGames } from '../src/extensions/gamemode_management/selectors';

describe('knownGames', () => {
  it('returns the known games', function () {
    let input = { session: { gameMode: { known: ['Skyrim', 'FalloutNV'] } } };
    let result = knownGames(input);
    expect(result).toEqual(['Skyrim', 'FalloutNV']);
  });
});

describe('currentGameDiscovery', () => {
  it('returns the discovery information about a game', function () {

    let gameMode1 = {
      path: 'path',
      modPath: 'modPath'
    };

    let activeProfileId1 = {
      gameId: 'gameId',
      id: 'id'
    };

    let input = {
      settings: {
        gameMode: { discovered: { gameId: 'gameMode1' } },
        profiles: { activeProfileId: 'activeProfileId1' }
      },
      persistent: { profiles: { activeProfileId1 } }
    };
    let result = currentGameDiscovery(input);
    expect(result).toEqual('gameMode1');
  });
});

describe('gameName', () => {
  it('returns the game name finding it inside the session', function () {

    let firstGameStored = {
      id: 'id1',
      name: 'name1'
    };

    let secondGameStored = {
      id: 'id2',
      name: 'name2'
    };

    let input = { session: { gameMode: { known: [firstGameStored, secondGameStored] } } };
    let result = gameName(input, 'id1');
    expect(result).toEqual('name1');
  });

  it('returns the game name finding it inside the settings', function () {
    let input = { settings: { gameMode: { discovered: { gameId1: { name: 'name' } } } } };
    let result = gameName(input, 'gameId1');
    expect(result).toEqual('name');
  });
});
