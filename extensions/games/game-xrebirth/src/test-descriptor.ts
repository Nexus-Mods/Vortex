/**
 * Per-game test harness descriptor. Consumed by `@vortex/game-extension-test`.
 *
 * The shape is mirrored from `IGameExtensionTestDescriptor` in
 * `@vortex/game-extension-test` to avoid the import dependency cycle during
 * normalization. Once the harness package is a devDep, the import can be
 * restored.
 */
export const testDescriptor = {
  gameId: "xrebirth",
  nexusGameDomain: "xrebirth",
  fixtures: {
    mostPopular: 0,
    mostRecent: 0,
    oldest: 0,
    allCollections: false,
    all: true,
  } as const,
  syntheticContent: {
    "content.xml": ({ manifestId }: { manifestId: string }) =>
      `<content id="mod-${manifestId}" name="Test ${manifestId}" version="1.0" author="harness"/>`,
  },
  skipHeuristics: [
    {
      reason: "Cheat Engine table (not an X Rebirth mod)",
      matches: (files) => files.length === 1 && /\.ct$/i.test(files[0]!),
    },
    {
      reason: "nested archive — user must extract before installing",
      matches: (files) => files.some((f) => /\.(7z|rar|zip)$/i.test(f)),
    },
    {
      reason: "single instruction text file (not installable content)",
      matches: (files) => files.length === 1 && /\.txt$/i.test(files[0]!),
    },
    {
      reason: "single XML config for an external tool",
      matches: (files) =>
        files.length === 1 && /\.xml$/i.test(files[0]!) && /(^|\/)(nesa|\d+-l\d+)/i.test(files[0]!),
    },
  ],
};
