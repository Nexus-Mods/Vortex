export const testDescriptor = {
  gameId: "pathfinderkingmaker",
  nexusGameDomain: "pathfinderkingmaker",
  fixtures: {
    mostPopular: 0,
    mostRecent: 0,
    oldest: 0,
    allCollections: false,
    all: true,
  } as const,
  syntheticContent: {},
  skipHeuristics: [
    {
      reason: "directory-only manifest (source code or empty archive, no installable files)",
      matches: (files: string[]): boolean => {
        const dataFiles = files.filter((f) => !f.endsWith("/") && !f.endsWith("\\"));
        return dataFiles.length === 0;
      },
    },
  ],
};
