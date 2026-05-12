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
 *
 * The `skipHeuristics` list captures upload shapes Vortex shouldn't try to
 * install automatically (source projects, instructions-only uploads, external
 * tools, etc.). Each predicate is evaluated against the archive's flat file
 * manifest before the installer chain runs; a match reports the fixture as
 * skipped instead of letting it surface as an installer rejection.
 */
const DOC_EXT_RE = /\.(txt|pdf|md|docx|rtf|html|htm)$/i;

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
  skipHeuristics: [
    {
      reason: "ModBuddy source project — needs compilation into a .XComMod first",
      matches: (files: string[]): boolean => files.some((f) => /\.(uc|x2proj)$/i.test(f)),
    },
    {
      reason: "nested archive — user must extract before installing",
      matches: (files: string[]): boolean => files.some((f) => /\.(7z|rar|zip)$/i.test(f)),
    },
    {
      reason: "instructions-only upload (readme/PDF, no installable content)",
      matches: (files: string[]): boolean => {
        const data = files.filter((f) => !f.endsWith("/") && !f.endsWith("\\"));
        return data.length > 0 && data.every((f) => DOC_EXT_RE.test(f));
      },
    },
    {
      reason: "ReShade / shader injector (graphics overlay, not an XCOM 2 mod)",
      matches: (files: string[]): boolean => files.some((f) => /\.(fx|fxh|hlsl)$/i.test(f)),
    },
    {
      reason: "standalone Windows tool (external utility, not an XCOM 2 mod)",
      matches: (files: string[]): boolean => {
        const data = files.filter((f) => !f.endsWith("/") && !f.endsWith("\\"));
        return (
          data.length > 0 &&
          data.every((f) => /\.(exe|dll|config|manifest|application|ico|ctk)$/i.test(f))
        );
      },
    },
    {
      reason: "Access database tool (design utility, not an XCOM 2 mod)",
      matches: (files: string[]): boolean => files.some((f) => /\.accdb$/i.test(f)),
    },
    {
      reason: "controller profile (.xpadderprofile, not an XCOM 2 mod)",
      matches: (files: string[]): boolean => files.some((f) => /\.xpadderprofile$/i.test(f)),
    },
    {
      reason: "movies/intro replacement (.bk2 only, deployed via a different path)",
      matches: (files: string[]): boolean => {
        const data = files.filter((f) => !f.endsWith("/") && !f.endsWith("\\"));
        return data.length > 0 && data.every((f) => /\.bk2$/i.test(f) || DOC_EXT_RE.test(f));
      },
    },
    {
      reason: "cheat-engine table (.ct, not an XCOM 2 mod)",
      matches: (files: string[]): boolean => files.length === 1 && /\.ct$/i.test(files[0]!),
    },
  ],
};
