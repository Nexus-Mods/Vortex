export interface IAllowListKey {
  domainName: string;
  numericGameId: number;
  internalId: string;
}

const allowList = new Map<IAllowListKey, Set<string>>([
  [{ domainName: 'newvegas', numericGameId: 130, internalId: 'falloutnv' }, new Set(['42507'])],
  [{ domainName: 'fallout3', numericGameId: 120, internalId: 'fallout3' }, new Set([])],
  [{ domainName: 'oblivion', numericGameId: 101, internalId: 'oblivion' }, new Set([])],
]);

/**
 * Get the CSharp script allow list for a specific game.
 * @param gameId internal game id (i.e. falloutnv)
 * @returns a set of allowed mod IDs
 */
export const getCSharpScriptAllowListForGame = (gameId: string): Set<string> => {
  const result = new Set<string>();
  for (const [key, value] of allowList.entries()) {
    if (key.internalId === gameId) {
      value.forEach(modId => result.add(modId));
    }
  }
  return result;
};