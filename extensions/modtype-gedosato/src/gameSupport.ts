const gameSupport = {
  darksouls2: {
    id: 'DarkSoulsII',
  },
};

export function gameSupported(gameId: string): boolean {
  return gameSupport[gameId] !== undefined;
}

export function getPath(gameId: string): string {
  return gameSupport[gameId].id;
}
