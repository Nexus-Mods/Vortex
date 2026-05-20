export const testDescriptor = {
  gameId: "pathfinderwrathoftherighteous",
  nexusGameDomain: "pathfinderwrathoftherighteous",
  fixtures: {
    mostPopular: 0,
    mostRecent: 0,
    oldest: 0,
    allCollections: false,
    all: true,
  } as const,
  syntheticContent: {},
  skipHeuristics: [] as {
    reason: string;
    matches: (files: string[]) => boolean;
  }[],
};
