/**
 * Per-game test harness descriptor. Consumed by `@vortex/game-extension-test`.
 *
 * The shape is mirrored from `IGameExtensionTestDescriptor` in
 * `@vortex/game-extension-test` to avoid the import dependency cycle during
 * normalization. Once the harness package is a devDep, the import can be
 * restored.
 *
 * `gameId` is the primary registered id; the installer's testMod accepts
 * `xcom2` and `xcom2-wotc`, and WOTC uses `nexusPageId: "xcom2"` so a single
 * descriptor covers fixtures for both.
 */
export const testDescriptor = {
  gameId: "xcom2",
  nexusGameDomain: "xcom2",
  fixtures: {
    mostPopular: 0,
    mostRecent: 0,
    oldest: 0,
    allCollections: false,
    all: true,
  } as const,
  syntheticContent: {},
  skipHeuristics: [],
};
